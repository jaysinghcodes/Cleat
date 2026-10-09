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
  sessionLoadError,
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
  loadError: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [client, setClient] = useState<CleatClient | null>(null);
  const alive = useRef(true);

  const hydrate = useCallback(async (supabase: CleatClient) => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!alive.current) return;
      const next = data.session;
      if (!next) {
        setSession(null);
        setMembership(null);
        setLoadError(null);
        setReady(true);
        return;
      }
      setSession({ userId: next.user.id, email: next.user.email ?? null });
      let current: Membership | null = null;
      try {
        current = await fetchMembership(supabase);
      } catch (err) {
        if (!alive.current) return;
        setMembership(null);
        setLoadError(sessionLoadError(err));
        setReady(true);
        return;
      }
      if (!alive.current) return;
      if (!current) {
        const pending = readPendingTrainer();
        if (pending) {
          let created = false;
          try {
            await createTrainerOrg(supabase, pending);
            localStorage.removeItem(PENDING_TRAINER_KEY);
            created = true;
            setError(null);
          } catch (err) {
            if (!alive.current) return;
            setError(err instanceof CleatRequestError ? err.message : copy.generic);
          }
          if (created) {
            try {
              current = await fetchMembership(supabase);
            } catch (err) {
              if (!alive.current) return;
              setMembership(null);
              setLoadError(sessionLoadError(err));
              setReady(true);
              return;
            }
          }
        }
      } else {
        localStorage.removeItem(PENDING_TRAINER_KEY);
      }
      if (!alive.current) return;
      setMembership(current);
      setLoadError(null);
      setReady(true);
    } catch (err) {
      if (!alive.current) return;
      setLoadError(sessionLoadError(err));
      setReady(true);
    }
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
      setLoadError(null);
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
    setLoadError(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ configured, ready, session, membership, error, loadError, refresh, signOut, client }),
    [configured, ready, session, membership, error, loadError, refresh, signOut, client],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
