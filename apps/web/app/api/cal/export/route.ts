import { bookingCopy, parseSessions } from "@cleat/domain";
import { buildCalendar, calendarResponse, eventsFromSessions } from "../../../../lib/ics-http";
import { jsonError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  const sessionId = new URL(request.url).searchParams.get("session");
  let query = user.supabase
    .from("sessions")
    .select("id, org_id, trainer_id, client_id, starts_at, ends_at, status, cancelled_at, cancelled_by, google_event_id")
    .order("starts_at", { ascending: true });
  if (sessionId) query = query.eq("id", sessionId);
  const { data, error } = await query;
  if (error) return jsonError(bookingCopy.linkInvalid, 400);
  const sessions = parseSessions(data).filter((session) => {
    if (sessionId) return true;
    const start = new Date(session.startsAt).getTime();
    const now = Date.now();
    if (session.status === "booked") return start > now - 86_400_000 && start < now + 120 * 86_400_000;
    if (!session.cancelledAt) return false;
    return new Date(session.cancelledAt).getTime() > now - 30 * 86_400_000;
  });
  if (sessionId && sessions.length === 0) return jsonError("That session is not yours.", 404);

  const ids = [...new Set(sessions.flatMap((session) => [session.trainerId, session.clientId]))];
  const profiles = ids.length
    ? await user.supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [], error: null };
  if (profiles.error) return jsonError(bookingCopy.linkInvalid, 400);
  const names = new Map(
    (profiles.data ?? []).map((row) => [String(row.id), String(row.display_name)]),
  );
  const ics = buildCalendar(
    eventsFromSessions(sessions, (session) => {
      const other = session.clientId === user.userId ? session.trainerId : session.clientId;
      return names.get(other) ?? "Cleat";
    }),
  );
  return calendarResponse(ics, sessionId ? "session.ics" : "cleat.ics", "private");
}
