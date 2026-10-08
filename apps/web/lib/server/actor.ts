import { createAuthorizedClient, fetchMembership, readPublicSupabaseConfig } from "@cleat/api";
import { aiCopy } from "@cleat/domain";
import { NextResponse } from "next/server";

export const aiCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

export function aiJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: aiCors });
}

export async function requireTrainer(request: Request): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; response: Response }
> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 401) };
  const config = readPublicSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
  });
  if (!config) return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 500) };
  const supabase = createAuthorizedClient(config, token);
  const membership = await fetchMembership(supabase);
  if (!membership || membership.role !== "trainer") {
    return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 403) };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 401) };
  return { ok: true, orgId: membership.orgId, userId: data.user.id };
}
