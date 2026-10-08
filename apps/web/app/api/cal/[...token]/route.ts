import { bookingCopy } from "@cleat/domain";
import { verifyFeedToken } from "@cleat/domain/feed-token";
import { NextResponse } from "next/server";
import { buildCalendar, calendarResponse, eventsFromFeed, type FeedRow } from "../../../../lib/ics-http";
import { anonClient, feedSecret } from "../../../../lib/server";

export const dynamic = "force-dynamic";

function plain(message: string, status: number): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string[] }> },
) {
  const secret = feedSecret();
  if (!secret) return plain("Calendar signing is not configured.", 503);
  const { token: parts } = await context.params;
  const token = parts.join("/");
  const verified = verifyFeedToken(token, secret);
  if (!verified) return plain(bookingCopy.linkInvalid, 400);

  const anon = anonClient();
  if (!anon) return plain(bookingCopy.linkInvalid, 400);
  const { data, error } = await anon.rpc("calendar_feed", { feed_nonce: verified.nonce });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("calendar_token_revoked")) return plain(bookingCopy.linkReplaced, 410);
    if (message.includes("calendar_token_missing")) return plain(bookingCopy.linkInvalid, 404);
    return plain(bookingCopy.linkInvalid, 400);
  }
  const rows = (Array.isArray(data) ? data : []) as FeedRow[];
  return calendarResponse(buildCalendar(eventsFromFeed(rows)), "cleat.ics", "public");
}
