import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public Supabase settings safe to ship in the web and mobile clients.
 * The service role, OpenAI key, and ICS signing secret stay on the server.
 * This module never reads a service role key.
 */
export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

export type CleatClient = SupabaseClient;

export type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

export function readPublicSupabaseConfig(env: {
  url?: string;
  anonKey?: string;
}): PublicSupabaseConfig | null {
  const url = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function createCleatClient(
  config: PublicSupabaseConfig,
  options?: {
    storage?: AuthStorage;
    detectSessionInUrl?: boolean;
  },
): CleatClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
      storage: options?.storage,
      flowType: "pkce",
    },
  });
}
