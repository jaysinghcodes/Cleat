import {
  acceptInvite,
  CleatRequestError,
  fetchCoach,
  fetchMembership,
  type CleatClient,
} from "@cleat/api";
import {
  copy,
  PENDING_INVITE_KEY,
  pendingInviteSchema,
  type CoachSummary,
  type Membership,
} from "@cleat/domain";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { getMobileSupabase, mobileSupabaseConfig } from "./supabase";

export type SessionUser = {
  userId: string;
  email: string | null;
};

type SessionContextValue = {
  configured: boolean;
  ready: boolean;
  session: SessionUser | null;
  membership: Membership | null;
  coach: CoachSummary | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  client: CleatClient | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function readPendingInvite() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const parsed = pendingInviteSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const configured = mobileSupabaseConfig() !== null;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [coach, setCoach] = useState<CoachSummary | null>(null);
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
      setCoach(null);
      setReady(true);
      return;
    }
    setSession({ userId: next.user.id, email: next.user.email ?? null });
    let current = await fetchMembership(supabase);
    if (!alive.current) return;
    if (!current) {
      const pending = await readPendingInvite();
      if (pending) {
        try {
          await acceptInvite(supabase, pending.inviteId, pending.displayName, pending.timezone);
          await AsyncStorage.removeItem(PENDING_INVITE_KEY);
          current = await fetchMembership(supabase);
          if (!alive.current) return;
          setError(null);
        } catch (err) {
          if (!alive.current) return;
          setError(err instanceof CleatRequestError ? err.message : copy.generic);
        }
      }
    } else {
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    }
    let nextCoach: CoachSummary | null = null;
    if (current?.role === "client") {
      nextCoach = await fetchCoach(supabase);
    }
    if (!alive.current) return;
    setMembership(current);
    setCoach(nextCoach);
    setReady(true);
  }, []);

  useEffect(() => {
    alive.current = true;
    const supabase = getMobileSupabase();
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
    const supabase = getMobileSupabase();
    if (!supabase) return;
    await hydrate(supabase);
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    const supabase = getMobileSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setMembership(null);
    setCoach(null);
    setError(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      configured,
      ready,
      session,
      membership,
      coach,
      error,
      refresh,
      signOut,
      client,
    }),
    [configured, ready, session, membership, coach, error, refresh, signOut, client],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
