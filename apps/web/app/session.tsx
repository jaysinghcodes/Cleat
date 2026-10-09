"use client";

import {
  CleatRequestError,
  createTrainerOrg,
  fetchMembership,
  type CleatClient,
} from "@cleat/api";
import {
  PENDING_TRAINER_KEY,
  copy,
  pendingTrainerSchema,
  type Membership,
} from "@cleat/domain";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { previewMembership } from "./preview/fixtures";
import { readScreenPreview } from "./preview-mode";
import { getWebSupabase, webSupabaseConfig } from "./supabase";

export type SessionUser = {
  userId: string;
  email: string | null;
};

type SessionContextValue = {
  configured: boolean;
  ready: boolean;
  session: SessionUser | null;
  membership: Membership | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  client: CleatClient | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function previewClient(): CleatClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error("Preview session cannot call the network.");
      },
    },
  ) as CleatClient;
}

function readPendingTrainer() {
  try {
    const raw = localStorage.getItem(PENDING_TRAINER_KEY);
    if (!raw) return null;
    const parsed = pendingTrainerSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [previewing, setPreviewing] = useState(false);
  const configured = webSupabaseConfig() !== null || previewing;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<CleatClient | null>(null);
  const alive = useRef(true);

  const hydrate = useCallback(async (supabase: CleatClient) => {
    const { data } = await supabase.auth.getSession();
    if (!alive.current) return;
    const next = data.session;
    if (!next) {
      setSession(null);
      setMembership(null);
      setReady(true);
      return;
    }
    setSession({ userId: next.user.id, email: next.user.email ?? null });
    let current = await fetchMembership(supabase);
    if (!alive.current) return;
    if (!current) {
      const pending = readPendingTrainer();
      if (pending) {
        try {
          await createTrainerOrg(supabase, pending);
          localStorage.removeItem(PENDING_TRAINER_KEY);
          current = await fetchMembership(supabase);
          if (!alive.current) return;
          setError(null);
        } catch (err) {
          if (!alive.current) return;
          setError(err instanceof CleatRequestError ? err.message : copy.generic);
        }
      }
    } else {
      localStorage.removeItem(PENDING_TRAINER_KEY);
    }
    setMembership(current);
    setReady(true);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (readScreenPreview()) {
      setPreviewing(true);
      setClient(previewClient());
      setSession({
        userId: "22222222-2222-4222-8222-222222222222",
        email: "alex@northgym.example",
      });
      setMembership(previewMembership);
      setReady(true);
      return () => {
        alive.current = false;
      };
    }
    const supabase = getWebSupabase();
    setClient(supabase);
    if (!supabase) {
      setReady(true);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange(() => {
      void hydrate(supabase);
    });
    void hydrate(supabase);
    return () => {
      alive.current = false;
      data.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refresh = useCallback(async () => {
    const supabase = getWebSupabase();
    if (!supabase) return;
    await hydrate(supabase);
  }, [hydrate]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(PENDING_TRAINER_KEY);
    const supabase = getWebSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setMembership(null);
    setError(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ configured, ready, session, membership, error, refresh, signOut, client }),
    [configured, ready, session, membership, error, refresh, signOut, client],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
