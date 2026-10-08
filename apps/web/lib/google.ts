import {
  bookingCopy,
  googleEventBody,
  isGoogleConfigured,
  sessionSummary,
} from "@cleat/domain";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceClient } from "./server";

export function readGoogleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!isGoogleConfigured({ clientId, clientSecret })) return null;
  return { clientId, clientSecret };
}

export function signOAuthState(userId: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readOAuthState(state: string, secret: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actual = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export function googleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function refreshAccessToken(
  config: { clientId: string; clientSecret: string },
  refreshToken: string,
): Promise<string | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function trainerRefreshToken(trainerId: string): Promise<string | null> {
  const admin = serviceClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("google_credentials")
    .select("refresh_token")
    .eq("user_id", trainerId)
    .maybeSingle();
  if (error || !data?.refresh_token) return null;
  return String(data.refresh_token);
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ refreshToken: string; email: string | null } | null> {
  const config = readGoogleConfig();
  if (!config) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { refresh_token?: string; access_token?: string };
  if (!json.refresh_token) return null;
  let email: string | null = null;
  if (json.access_token) {
    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (profile.ok) {
      const body = (await profile.json()) as { email?: string };
      email = body.email ?? null;
    }
  }
  return { refreshToken: json.refresh_token, email };
}

export async function storeGoogleCredentials(input: {
  userId: string;
  orgId: string;
  refreshToken: string;
  email: string | null;
}): Promise<boolean> {
  const admin = serviceClient();
  if (!admin) return false;
  const { error } = await admin.from("google_credentials").upsert({
    user_id: input.userId,
    org_id: input.orgId,
    refresh_token: input.refreshToken,
    email: input.email,
    connected_at: new Date().toISOString(),
  });
  return !error;
}

async function writeEvent(
  accessToken: string,
  body: ReturnType<typeof googleEventBody>,
  eventId: string | null,
): Promise<string | null> {
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const response = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { id?: string };
  return json.id ?? eventId;
}

export async function syncGoogleBooking(input: {
  trainerId: string;
  sessionId: string;
  startsAt: string;
  endsAt: string;
  personName: string;
  googleEventId: string | null;
  attach: (eventId: string) => Promise<void>;
}): Promise<boolean> {
  const config = readGoogleConfig();
  if (!config) return false;
  try {
    const refreshToken = await trainerRefreshToken(input.trainerId);
    if (!refreshToken) return false;
    const access = await refreshAccessToken(config, refreshToken);
    if (!access) return false;
    const eventId = await writeEvent(
      access,
      googleEventBody({
        summary: sessionSummary(input.personName),
        description: bookingCopy.sessionDescription,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      }),
      input.googleEventId,
    );
    if (!eventId) return false;
    if (eventId !== input.googleEventId) await input.attach(eventId);
    return true;
  } catch {
    return false;
  }
}

export async function deleteGoogleBooking(trainerId: string, eventId: string | null): Promise<void> {
  const config = readGoogleConfig();
  if (!config || !eventId) return;
  try {
    const refreshToken = await trainerRefreshToken(trainerId);
    if (!refreshToken) return;
    const access = await refreshAccessToken(config, refreshToken);
    if (!access) return;
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${access}` } },
    );
  } catch {
    // ICS remains the calendar of record when Google is unreachable.
  }
}

export async function trainerOrgId(userId: string): Promise<string | null> {
  const admin = serviceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "trainer")
    .maybeSingle();
  return data?.org_id ? String(data.org_id) : null;
}
