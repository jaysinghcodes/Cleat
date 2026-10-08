import {
  CleatRequestError,
  createAuthorizedClient,
  deliverChatMessage,
  readPublicSupabaseConfig,
} from "@cleat/api";
import { chatCopy } from "@cleat/domain";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: cors });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: chatCopy.signIn }, 401);

  const config = readPublicSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
  });
  if (!config) return json({ error: chatCopy.sendFailed }, 500);

  let payload: { body?: unknown; clientId?: unknown };
  try {
    payload = (await request.json()) as { body?: unknown; clientId?: unknown };
  } catch {
    return json({ error: chatCopy.emptyBody }, 400);
  }

  const supabase = createAuthorizedClient(config, token);
  try {
    const message = await deliverChatMessage(
      supabase,
      {
        body: typeof payload.body === "string" ? payload.body : "",
        clientId: typeof payload.clientId === "string" ? payload.clientId : undefined,
      },
      { accessToken: token },
    );
    return json({ message }, 200);
  } catch (err) {
    const message = err instanceof CleatRequestError ? err.message : chatCopy.sendFailed;
    const status = message === chatCopy.signIn ? 401 : 400;
    return json({ error: message }, status);
  }
}
