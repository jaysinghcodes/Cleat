import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  readGoogleConfig,
  readOAuthState,
  storeGoogleCredentials,
  trainerOrgId,
} from "../../../../../lib/google";
import { requestOrigin } from "../../../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = readGoogleConfig();
  const origin = requestOrigin(request);
  if (!config) {
    return NextResponse.redirect(`${origin}/org?google=off`);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  // State is an HMAC of the signed-in user id and a 10 minute expiry.
  // The start route signs that user. This redirect carries no session cookie.
  const userId = readOAuthState(state, config.clientSecret);
  if (!code || !userId) {
    return NextResponse.redirect(`${origin}/org?google=denied`);
  }
  const exchanged = await exchangeGoogleCode({
    code,
    redirectUri: `${origin}/api/google/oauth/callback`,
  });
  if (!exchanged) return NextResponse.redirect(`${origin}/org?google=denied`);
  const orgId = await trainerOrgId(userId);
  if (!orgId) return NextResponse.redirect(`${origin}/org?google=storage`);
  const stored = await storeGoogleCredentials({
    userId,
    orgId,
    refreshToken: exchanged.refreshToken,
  });
  if (!stored) return NextResponse.redirect(`${origin}/org?google=storage`);
  return NextResponse.redirect(`${origin}/org?google=connected`);
}
