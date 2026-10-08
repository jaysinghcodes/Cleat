import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server only. The service role bypasses RLS and must never reach a client bundle. */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
