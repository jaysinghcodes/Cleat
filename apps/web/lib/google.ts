import {
  bookingCopy,
  googleEventBody,
  isGoogleConfigured,
  sessionSummary,
} from "@cleat/domain";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceClient } from "./server";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export type GoogleHttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type GoogleHttp = (url: string, init?: RequestInit) => Promise<GoogleHttpResponse>;

export type GoogleRuntime = {
  http?: GoogleHttp;
  config?: { clientId: string; clientSecret: string } | null;
  refreshToken?: string | null;
};

const defaultHttp: GoogleHttp = (url, init) => fetch(url, init);

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
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

function httpFrom(runtime: GoogleRuntime): GoogleHttp {
  return runtime.http ?? defaultHttp;
}

function configFrom(runtime: GoogleRuntime): { clientId: string; clientSecret: string } | null {
  if ("config" in runtime) return runtime.config ?? null;
  return readGoogleConfig();
}

async function refreshAccessToken(
  http: GoogleHttp,
  config: { clientId: string; clientSecret: string },
  refreshToken: string,
): Promise<string | null> {
  const response = await http("https://oauth2.googleapis.com/token", {
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

/** Stable Calendar event id. A retry uses the same id, so Google will not create a second event. */
export function calendarEventId(sessionId: string, existing: string | null): string {
  const stored = existing?.trim();
  if (stored) return stored;
  return sessionId.replace(/-/g, "").toLowerCase();
}

export async function trainerRefreshToken(trainerId: string): Promise<string | null> {
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

export async function exchangeGoogleCode(
  input: {
    code: string;
    redirectUri: string;
  },
  runtime: GoogleRuntime = {},
): Promise<{ refreshToken: string } | null> {
  const config = configFrom(runtime);
  if (!config) return null;
  const response = await httpFrom(runtime)("https://oauth2.googleapis.com/token", {
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
  const json = (await response.json()) as { refresh_token?: string };
  if (!json.refresh_token) return null;
  return { refreshToken: json.refresh_token };
}

export async function storeGoogleCredentials(input: {
  userId: string;
  orgId: string;
  refreshToken: string;
}): Promise<boolean> {
  const admin = serviceClient();
  if (!admin) return false;
  const { error } = await admin.from("google_credentials").upsert({
    user_id: input.userId,
    org_id: input.orgId,
    refresh_token: input.refreshToken,
    email: null,
    connected_at: new Date().toISOString(),
  });
  return !error;
}

async function writeEvent(
  http: GoogleHttp,
  accessToken: string,
  body: ReturnType<typeof googleEventBody>,
  eventId: string,
  alreadyAttached: boolean,
): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const target = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  if (alreadyAttached) {
    const patched = await http(target, { method: "PATCH", headers, body: JSON.stringify(body) });
    return patched.ok ? eventId : null;
  }
  const created = await http("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, id: eventId }),
  });
  if (created.ok) {
    const json = (await created.json()) as { id?: string };
    return json.id ?? eventId;
  }
  if (created.status !== 409) return null;
  const patched = await http(target, { method: "PATCH", headers, body: JSON.stringify(body) });
  return patched.ok ? eventId : null;
}

async function tokenFor(trainerId: string, runtime: GoogleRuntime): Promise<string | null> {
  if ("refreshToken" in runtime) return runtime.refreshToken ?? null;
  return trainerRefreshToken(trainerId);
}

export async function syncGoogleBooking(
  input: {
    trainerId: string;
    sessionId: string;
    startsAt: string;
    endsAt: string;
    personName: string;
    googleEventId: string | null;
    attach: (eventId: string) => Promise<void>;
  },
  runtime: GoogleRuntime = {},
): Promise<boolean> {
  const config = configFrom(runtime);
  if (!config) return false;
  try {
    const refreshToken = await tokenFor(input.trainerId, runtime);
    if (!refreshToken) return false;
    const access = await refreshAccessToken(httpFrom(runtime), config, refreshToken);
    if (!access) return false;
    const eventId = calendarEventId(input.sessionId, input.googleEventId);
    const written = await writeEvent(
      httpFrom(runtime),
      access,
      googleEventBody({
        summary: sessionSummary(input.personName),
        description: bookingCopy.sessionDescription,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      }),
      eventId,
      Boolean(input.googleEventId?.trim()),
    );
    if (!written) return false;
    if (written !== input.googleEventId) await input.attach(written);
    return true;
  } catch {
    return false;
  }
}

export async function deleteGoogleBooking(
  trainerId: string,
  eventId: string | null,
  runtime: GoogleRuntime = {},
): Promise<boolean> {
  const config = configFrom(runtime);
  if (!config || !eventId) return false;
  try {
    const refreshToken = await tokenFor(trainerId, runtime);
    if (!refreshToken) return false;
    const access = await refreshAccessToken(httpFrom(runtime), config, refreshToken);
    if (!access) return false;
    const response = await httpFrom(runtime)(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${access}` } },
    );
    return response.ok || response.status === 404 || response.status === 410;
  } catch {
    return false;
  }
}

export async function disconnectGoogleAccount(input: {
  refreshToken: string | null;
  http?: GoogleHttp;
  deleteCredentials: () => Promise<void>;
}): Promise<void> {
  if (input.refreshToken) {
    try {
      await (input.http ?? defaultHttp)("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: input.refreshToken }),
      });
    } catch {
      // Revoke is best effort. Local credentials still go away.
    }
  }
  await input.deleteCredentials();
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
