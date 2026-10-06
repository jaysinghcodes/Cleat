/**
 * Public Supabase settings safe to ship in the web and mobile clients.
 * The service role, OpenAI key, and ICS signing secret stay on the server.
 */
export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
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
