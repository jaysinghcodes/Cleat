import {
  bookingCopy,
  cancelCutoffSchema,
  copy,
  parseAvailability,
  userFacingError,
  parseSessions,
  primaryCalendarSchema,
  slotMinutesSchema,
  type AvailabilityBlock,
  type PrimaryCalendar,
  type SessionRecord,
  type WeeklyDraft,
} from "@cleat/domain";
import { CleatRequestError } from "./auth";
import type { CleatClient } from "./supabase";

export type OrgCalendarSettings = {
  cancelCutoffHours: number;
  primaryCalendar: PrimaryCalendar;
};

export type TrainerCalendarData = {
  blocks: AvailabilityBlock[];
  sessions: SessionRecord[];
  slotMinutes: number;
  settings: OrgCalendarSettings;
};

export type ClientCalendarData = {
  blocks: AvailabilityBlock[];
  sessions: SessionRecord[];
  taken: { startsAt: string; endsAt: string }[];
  slotMinutes: number;
  trainerId: string;
  trainerName: string;
  trainerTimezone: string;
  cancelCutoffHours: number;
};

export type BookResult = {
  session: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: "booked" | "cancelled";
  };
  confirmation: string;
  googleSynced: boolean;
};

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
};

export type SubscribeLink = {
  url: string;
};

function fail(message: string | undefined, fallback: string, status?: number): never {
  throw new CleatRequestError(userFacingError(message, fallback), status);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function cleatFetch<T>(
  url: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await readJson(response);
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : copy.generic;
    fail(message, copy.generic, response.status);
  }
  return body as T;
}

export async function accessToken(supabase: CleatClient): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) fail(error?.message, copy.generic);
  return token;
}

export async function loadTrainerCalendar(
  supabase: CleatClient,
  orgId: string,
): Promise<TrainerCalendarData> {
  const [blocks, sessions, settings, org] = await Promise.all([
    supabase
      .from("availability_blocks")
      .select("id, weekday, override_date, start_minute, end_minute, available")
      .eq("org_id", orgId),
    supabase
      .from("sessions")
      .select(
        "id, org_id, trainer_id, client_id, starts_at, ends_at, status, cancelled_at, cancelled_by, google_event_id",
      )
      .eq("org_id", orgId)
      .order("starts_at", { ascending: true }),
    supabase.from("trainer_settings").select("slot_minutes").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("orgs")
      .select("cancel_cutoff_hours, primary_calendar")
      .eq("id", orgId)
      .maybeSingle(),
  ]);
  if (blocks.error) fail(blocks.error.message, copy.generic);
  if (sessions.error) fail(sessions.error.message, copy.generic);
  if (settings.error) fail(settings.error.message, copy.generic);
  if (org.error) fail(org.error.message, copy.generic);
  const slot = slotMinutesSchema.safeParse(settings.data?.slot_minutes);
  const cutoff = cancelCutoffSchema.safeParse(org.data?.cancel_cutoff_hours);
  const primary = primaryCalendarSchema.safeParse(org.data?.primary_calendar);
  return {
    blocks: parseAvailability(blocks.data),
    sessions: parseSessions(sessions.data),
    slotMinutes: slot.success ? slot.data : 60,
    settings: {
      cancelCutoffHours: cutoff.success ? cutoff.data : 12,
      primaryCalendar: primary.success ? primary.data : "ics",
    },
  };
}

export async function saveWeeklyAvailability(
  supabase: CleatClient,
  orgId: string,
  trainerId: string,
  days: WeeklyDraft[],
): Promise<void> {
  const removed = await supabase
    .from("availability_blocks")
    .delete()
    .eq("trainer_id", trainerId)
    .is("override_date", null);
  if (removed.error) fail(removed.error.message, copy.generic);
  const rows = days
    .filter((day) => day.available && day.endMinute > day.startMinute)
    .map((day) => ({
      org_id: orgId,
      trainer_id: trainerId,
      weekday: day.weekday,
      start_minute: day.startMinute,
      end_minute: day.endMinute,
      available: true,
    }));
  if (rows.length === 0) return;
  const inserted = await supabase.from("availability_blocks").insert(rows);
  if (inserted.error) fail(inserted.error.message, copy.generic);
}

export async function saveAvailabilityOverride(
  supabase: CleatClient,
  orgId: string,
  trainerId: string,
  input: { date: string; available: boolean; startMinute: number; endMinute: number },
): Promise<void> {
  const removed = await supabase
    .from("availability_blocks")
    .delete()
    .eq("trainer_id", trainerId)
    .eq("override_date", input.date);
  if (removed.error) fail(removed.error.message, copy.generic);
  const inserted = await supabase.from("availability_blocks").insert({
    org_id: orgId,
    trainer_id: trainerId,
    override_date: input.date,
    start_minute: input.available ? input.startMinute : 0,
    end_minute: input.available ? input.endMinute : 60,
    available: input.available,
  });
  if (inserted.error) fail(inserted.error.message, copy.generic);
}

export async function clearAvailabilityOverride(
  supabase: CleatClient,
  trainerId: string,
  date: string,
): Promise<void> {
  const removed = await supabase
    .from("availability_blocks")
    .delete()
    .eq("trainer_id", trainerId)
    .eq("override_date", date);
  if (removed.error) fail(removed.error.message, copy.generic);
}

export async function saveSlotMinutes(
  supabase: CleatClient,
  trainerId: string,
  slotMinutes: number,
): Promise<void> {
  const parsed = slotMinutesSchema.parse(slotMinutes);
  const updated = await supabase
    .from("trainer_settings")
    .update({ slot_minutes: parsed })
    .eq("user_id", trainerId);
  if (updated.error) fail(updated.error.message, copy.generic);
}

export async function saveOrgCalendarSettings(
  supabase: CleatClient,
  orgId: string,
  settings: OrgCalendarSettings,
): Promise<void> {
  const cutoff = cancelCutoffSchema.parse(settings.cancelCutoffHours);
  const primary = primaryCalendarSchema.parse(settings.primaryCalendar);
  const updated = await supabase
    .from("orgs")
    .update({ cancel_cutoff_hours: cutoff, primary_calendar: primary })
    .eq("id", orgId);
  if (updated.error) fail(updated.error.message, bookingCopy.connectGoogleFirst);
}

export async function loadClientCalendar(
  supabase: CleatClient,
  orgId: string,
): Promise<ClientCalendarData> {
  const [blocks, sessions, taken, settings, org] = await Promise.all([
    supabase
      .from("availability_blocks")
      .select("id, weekday, override_date, start_minute, end_minute, available")
      .eq("org_id", orgId),
    supabase
      .from("sessions")
      .select(
        "id, org_id, trainer_id, client_id, starts_at, ends_at, status, cancelled_at, cancelled_by, google_event_id",
      )
      .order("starts_at", { ascending: true }),
    supabase.rpc("booked_ranges"),
    supabase.from("trainer_settings").select("user_id, slot_minutes").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("orgs")
      .select("cancel_cutoff_hours")
      .eq("id", orgId)
      .maybeSingle(),
  ]);
  if (blocks.error) fail(blocks.error.message, copy.generic);
  if (sessions.error) fail(sessions.error.message, copy.generic);
  if (taken.error) fail(taken.error.message, copy.generic);
  if (settings.error) fail(settings.error.message, copy.generic);
  if (org.error) fail(org.error.message, copy.generic);
  const trainerId = String(settings.data?.user_id ?? "");
  const profile = trainerId
    ? await supabase.from("profiles").select("display_name, timezone").eq("id", trainerId).maybeSingle()
    : { data: null, error: null };
  if (profile.error) fail(profile.error.message, copy.generic);
  const slot = slotMinutesSchema.safeParse(settings.data?.slot_minutes);
  const cutoff = cancelCutoffSchema.safeParse(org.data?.cancel_cutoff_hours);
  const takenRows = Array.isArray(taken.data) ? taken.data : [];
  return {
    blocks: parseAvailability(blocks.data),
    sessions: parseSessions(sessions.data),
    taken: takenRows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const record = row as { starts_at?: string; ends_at?: string };
        if (!record.starts_at || !record.ends_at) return null;
        return { startsAt: record.starts_at, endsAt: record.ends_at };
      })
      .filter((row): row is { startsAt: string; endsAt: string } => row !== null),
    slotMinutes: slot.success ? slot.data : 60,
    trainerId,
    trainerName: String(profile.data?.display_name ?? "your coach"),
    trainerTimezone: String(profile.data?.timezone ?? "UTC"),
    cancelCutoffHours: cutoff.success ? cutoff.data : 12,
  };
}

export async function bookSession(webOrigin: string, token: string, startsAt: string): Promise<BookResult> {
  return cleatFetch<BookResult>(`${webOrigin}/api/sessions/book`, token, {
    method: "POST",
    body: { startsAt },
  });
}

export async function cancelSession(webOrigin: string, token: string, sessionId: string): Promise<void> {
  await cleatFetch(`${webOrigin}/api/sessions/cancel`, token, {
    method: "POST",
    body: { sessionId },
  });
}

export async function subscribeLink(
  webOrigin: string,
  token: string,
  regenerate = false,
): Promise<SubscribeLink> {
  return cleatFetch<SubscribeLink>(`${webOrigin}/api/cal/token`, token, {
    method: "POST",
    body: { regenerate },
  });
}

export async function downloadIcs(
  webOrigin: string,
  token: string,
  sessionId?: string,
): Promise<string> {
  const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
  const response = await fetch(`${webOrigin}/api/cal/export${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) {
    fail(text.includes("error") ? bookingCopy.linkInvalid : text, copy.generic, response.status);
  }
  return text;
}

export async function googleStatus(webOrigin: string, token: string): Promise<GoogleStatus> {
  try {
    return await cleatFetch<GoogleStatus>(`${webOrigin}/api/google/status`, token);
  } catch {
    return { configured: false, connected: false, email: null };
  }
}

export async function startGoogleConnect(webOrigin: string, token: string): Promise<string> {
  const body = await cleatFetch<{ url?: string }>(`${webOrigin}/api/google/oauth/start`, token, {
    method: "POST",
  });
  if (!body.url) fail(undefined, copy.generic);
  return body.url;
}

export async function disconnectGoogle(webOrigin: string, token: string): Promise<void> {
  await cleatFetch(`${webOrigin}/api/google/disconnect`, token, { method: "POST" });
}
