import { NextResponse } from "next/server";
import { googleAuthUrl, readGoogleConfig, signOAuthState } from "../../../../../lib/google";
import { jsonError, requestOrigin, userClientFromRequest } from "../../../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = readGoogleConfig();
  if (!config) return jsonError("Google Calendar is not configured.", 404);
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  const membership = await user.supabase.rpc("current_membership");
  const row = Array.isArray(membership.data) ? membership.data[0] : null;
  const role = row && typeof row === "object" ? String((row as { role?: string }).role ?? "") : "";
  if (role !== "trainer") return jsonError("Only a coach can connect Google Calendar.", 403);
  const origin = requestOrigin(request);
  const url = googleAuthUrl({
    clientId: config.clientId,
    redirectUri: `${origin}/api/google/oauth/callback`,
    state: signOAuthState(user.userId, config.clientSecret),
  });
  return NextResponse.json({ url });
}
