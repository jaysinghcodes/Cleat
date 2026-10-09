import { createAuthorizedClient, fetchMembership, readPublicSupabaseConfig, type CleatClient } from "@cleat/api";
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

type TrainerGateDeps = {
  readConfig: typeof readPublicSupabaseConfig;
  createClient: (config: { url: string; anonKey: string }, token: string) => CleatClient;
  fetchMembership: typeof fetchMembership;
};

function unauthorized() {
  return { ok: false as const, response: aiJson({ error: aiCopy.loadFailed }, 401) };
}

export async function requireTrainer(
  request: Request,
  deps: TrainerGateDeps = {
    readConfig: readPublicSupabaseConfig,
    createClient: createAuthorizedClient,
    fetchMembership,
  },
): Promise<{ ok: true; orgId: string; userId: string } | { ok: false; response: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized();
  const config = deps.readConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
  });
  if (!config) return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 500) };
  const supabase = deps.createClient(config, token);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return unauthorized();
    const membership = await deps.fetchMembership(supabase);
    if (!membership || membership.role !== "trainer") {
      return { ok: false, response: aiJson({ error: aiCopy.loadFailed }, 403) };
    }
    return { ok: true, orgId: membership.orgId, userId: data.user.id };
  } catch {
    return unauthorized();
  }
}
