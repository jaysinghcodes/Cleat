import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bookingCopy, copy } from "@cleat/domain";
import { NextResponse } from "next/server";

export function serverSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function feedSecret(): string | null {
  const secret = process.env.ICS_FEED_SIGNING_SECRET?.trim() ?? "";
  return secret.length >= 16 ? secret : null;
}

export function serviceClient(): SupabaseClient | null {
  const env = serverSupabaseEnv();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE?.trim() ?? "";
  if (!env || !serviceRole) return null;
  return createClient(env.url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function userClientFromRequest(request: Request): Promise<{
  supabase: SupabaseClient;
  userId: string;
} | null> {
  const env = serverSupabaseEnv();
  if (!env) return null;
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const authClient = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  // accessToken is the only bearer PostgREST uses. The anon key stays in apikey.
  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => token,
  });
  return { supabase, userId: data.user.id };
}

export function anonClient(): SupabaseClient | null {
  const env = serverSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

const KNOWN = [
  bookingCopy.slotTaken,
  bookingCopy.slotClosed,
  bookingCopy.alreadyThen,
  bookingCopy.alreadyCancelled,
  bookingCopy.notYours,
  bookingCopy.signInBook,
  bookingCopy.signInSync,
  bookingCopy.clientsOnly,
  bookingCopy.connectGoogleFirst,
] as const;

export function publicBookingError(message: string): { status: number; error: string } {
  const cutoff = message.match(/You can cancel up to \d+ hours before the session\./);
  if (cutoff?.[0]) return { status: 403, error: cutoff[0] };
  const known = KNOWN.find((item) => message.includes(item));
  if (!known) return { status: 400, error: copy.generic };
  if (known === bookingCopy.slotTaken || known === bookingCopy.slotClosed || known === bookingCopy.alreadyThen) {
    return { status: 409, error: known };
  }
  if (known === bookingCopy.alreadyCancelled) return { status: 409, error: known };
  if (known === bookingCopy.notYours) return { status: 404, error: known };
  if (known === bookingCopy.signInBook || known === bookingCopy.signInSync) return { status: 401, error: known };
  if (known === bookingCopy.clientsOnly || known === bookingCopy.connectGoogleFirst) {
    return { status: 403, error: known };
  }
  return { status: 400, error: known };
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function rpcError(message: string | undefined): NextResponse {
  const mapped = publicBookingError(message ?? "");
  return jsonError(mapped.error, mapped.status);
}
