import { NextResponse } from "next/server";
import { jsonError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  const { error } = await user.supabase.rpc("disconnect_google");
  if (error) return jsonError("Something went wrong. Try again.", 400);
  return NextResponse.json({ ok: true });
}
