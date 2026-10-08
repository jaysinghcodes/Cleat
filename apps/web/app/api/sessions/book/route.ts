import { confirmationLine, deferredPushNotifier } from "@cleat/domain";
import { NextResponse } from "next/server";
import { syncGoogleBooking } from "../../../../lib/google";
import { jsonError, rpcError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  trainer_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: "booked" | "cancelled";
  google_event_id: string | null;
};

export async function POST(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before booking a session.", 401);
  let startsAt = "";
  try {
    const body = (await request.json()) as { startsAt?: string };
    startsAt = body.startsAt ?? "";
  } catch {
    return jsonError("That slot is not open.", 409);
  }
  if (!startsAt) return jsonError("That slot is not open.", 409);

  const booked = await user.supabase.rpc("book_session", { slot_start: startsAt });
  if (booked.error) return rpcError(booked.error.message);
  const sessionId = String(booked.data ?? "");
  const session = await user.supabase
    .from("sessions")
    .select("id, trainer_id, client_id, starts_at, ends_at, status, google_event_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (session.error || !session.data) return jsonError("Something went wrong. Try again.", 400);
  const row = session.data as SessionRow;
  const [trainer, client] = await Promise.all([
    user.supabase.from("profiles").select("display_name").eq("id", row.trainer_id).maybeSingle(),
    user.supabase.from("profiles").select("display_name").eq("id", row.client_id).maybeSingle(),
  ]);
  const trainerName = String(trainer.data?.display_name ?? "your coach");
  const clientName = String(client.data?.display_name ?? "Client");
  const googleSynced = await syncGoogleBooking({
    trainerId: row.trainer_id,
    sessionId: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    personName: clientName,
    googleEventId: row.google_event_id,
    attach: async (eventId) => {
      await user.supabase.rpc("attach_google_event", { session_id: row.id, event_id: eventId });
    },
  });
  await deferredPushNotifier.sessionBooked(row.id);
  return NextResponse.json(
    {
      session: {
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
      },
      confirmation: confirmationLine(trainerName, googleSynced),
      googleSynced,
    },
    { status: 201 },
  );
}
