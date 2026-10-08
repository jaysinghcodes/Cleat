import {
  ICS_CACHE_TTL_SECONDS,
  bookingCopy,
  buildIcs,
  sessionSummary,
  type IcsEventInput,
  type SessionRecord,
} from "@cleat/domain";
import { NextResponse } from "next/server";

export type FeedRow = {
  session_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  person_name: string;
};

export function eventsFromFeed(rows: FeedRow[]): IcsEventInput[] {
  return rows.map((row) => ({
    uid: row.session_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    summary: sessionSummary(row.person_name || "Cleat"),
    description: bookingCopy.sessionDescription,
    status: row.status === "cancelled" ? "cancelled" : "confirmed",
  }));
}

export function eventsFromSessions(sessions: SessionRecord[], nameFor: (session: SessionRecord) => string): IcsEventInput[] {
  return sessions.map((session) => ({
    uid: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    summary: sessionSummary(nameFor(session)),
    description: bookingCopy.sessionDescription,
    status: session.status === "cancelled" ? "cancelled" : "confirmed",
  }));
}

export function calendarResponse(ics: string, filename: string, cache: "public" | "private"): NextResponse {
  const control =
    cache === "public" ? `public, max-age=${ICS_CACHE_TTL_SECONDS}` : "private, no-store";
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": control,
    },
  });
}

export function buildCalendar(events: IcsEventInput[]): string {
  return buildIcs(bookingCopy.calendarName, events);
}
