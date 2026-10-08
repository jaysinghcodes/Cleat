import { deferredPushNotifier } from "@cleat/domain";
import { NextResponse } from "next/server";
import { deleteGoogleBooking } from "../../../../lib/google";
import { jsonError, rpcError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before booking a session.", 401);
  let sessionId = "";
  try {
    const body = (await request.json()) as { sessionId?: string };
    sessionId = body.sessionId ?? "";
  } catch {
    return jsonError("That session is not yours.", 404);
  }
  if (!sessionId) return jsonError("That session is not yours.", 404);

  const existing = await user.supabase
    .from("sessions")
    .select("id, trainer_id, google_event_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (existing.error) return rpcError(existing.error.message);
  if (!existing.data) return jsonError("That session is not yours.", 404);

  const cancelled = await user.supabase.rpc("cancel_session", { session_id: sessionId });
  if (cancelled.error) return rpcError(cancelled.error.message);

  await deleteGoogleBooking(
    String(existing.data.trainer_id),
    existing.data.google_event_id ? String(existing.data.google_event_id) : null,
  );
  await deferredPushNotifier.sessionCancelled(sessionId);
  return NextResponse.json({ ok: true });
}
