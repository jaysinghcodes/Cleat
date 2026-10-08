import { copy } from "@cleat/domain";
import { signFeedToken } from "@cleat/domain/feed-token";
import { jsonError, requestOrigin, rpcError, userClientFromRequest, feedSecret } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = feedSecret();
  if (!secret) return jsonError("Calendar signing is not configured.", 503);
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  let regenerate = false;
  try {
    const body = (await request.json()) as { regenerate?: boolean };
    regenerate = Boolean(body.regenerate);
  } catch {
    regenerate = false;
  }
  const issued = await user.supabase.rpc("issue_calendar_token", { regenerate });
  if (issued.error) return rpcError(issued.error.message);
  if (typeof issued.data !== "string" || !issued.data) {
    return jsonError(copy.generic, 400);
  }
  const token = signFeedToken(user.userId, issued.data, secret);
  const url = `${requestOrigin(request)}/api/cal/${token}.ics`;
  return Response.json({ url });
}
