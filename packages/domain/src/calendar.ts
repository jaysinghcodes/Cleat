import * as z from "zod";
import { firstName } from "./auth";

/** Default 1:1 length for a new trainer. The demo seed uses 45. */
export const DEFAULT_SLOT_MINUTES = 60;

/** Clients can cancel until this many hours before the session, unless the org changes it. */
export const DEFAULT_CANCEL_CUTOFF_HOURS = 12;

/**
 * Subscribe responses send `Cache-Control: public, max-age=60`.
 * A book or cancel is in the next uncached fetch. Caches may keep the previous file for this long.
 * Calendar apps also poll on their own schedule.
 */
export const ICS_CACHE_TTL_SECONDS = 60;

export const PRIMARY_CALENDARS = ["ics", "google"] as const;

export const primaryCalendarSchema = z.enum(PRIMARY_CALENDARS);

export type PrimaryCalendar = z.infer<typeof primaryCalendarSchema>;

export const slotMinutesSchema = z
  .number()
  .int()
  .refine((value) => value >= 15 && value <= 180 && value % 15 === 0, "Choose a slot length from 15 to 180 minutes.");

export const cancelCutoffSchema = z
  .number()
  .int()
  .refine((value) => value >= 0 && value <= 168, "Enter a cutoff between 0 and 168 hours.");

export const bookingCopy = {
  calendarSubtitle: "Availability · bookings · ICS sync",
  primaryIcs: "ICS feed",
  primaryGoogle: "Google Calendar",
  cutoffLabel: "Client cancellation cutoff (hours)",
  slotLabel: "Slot length",
  slotTaken: "That slot was just booked. Pick another time.",
  slotClosed: "That slot is not open.",
  alreadyThen: "You already have a session then.",
  alreadyCancelled: "This session is already cancelled.",
  notYours: "That session is not yours.",
  signInBook: "Sign in before booking a session.",
  clientsOnly: "Only a client can book a session.",
  signInSync: "Sign in before syncing a calendar.",
  linkInvalid: "This calendar link is not valid.",
  linkReplaced: "This calendar link has been replaced.",
  connectGoogleFirst: "Connect Google Calendar before choosing it.",
  cancelConfirm: "Cancel this session?",
  keepSession: "Keep session",
  cancelSession: "Cancel session",
  noUpcoming: "No upcoming session.",
  noSlots: "No open slots this day.",
  off: "Off",
  unavailable: "Unavailable",
  booked: "Booked",
  openSlots: "Open slots",
  bookedSessions: "Booked sessions",
  visibleToClients: "Visible to clients",
  cancels: "Cancels in 7 days",
  thisWeek: "This week",
  addToCalendar: "Add to calendar",
  subscribe: "Subscribe in your calendar",
  syncIcs: "Sync ICS",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  regenerate: "Regenerate link",
  regenerateHint: "The old link will stop working.",
  editAvailability: "Edit availability",
  saveAvailability: "Save availability",
  saveOverride: "Save override",
  clearOverride: "Clear override",
  previousWeek: "Previous week",
  nextWeek: "Next week",
  afterBookTitle: "After you book",
  afterBookBody: "You get an ICS file and a subscribe link. Your coach sees the session on the desk.",
  googleConnect: "Connect Google Calendar",
  googleConnected: "Google Calendar connected",
  googleDisconnect: "Disconnect Google Calendar",
  googleOff: "ICS feed is the calendar for this desk.",
  sessionDescription: "1:1 session in Cleat.",
  calendarName: "Cleat",
} as const;

export function cancelCutoffMessage(hours: number): string {
  return `You can cancel up to ${hours} hours before the session.`;
}

export function confirmationLine(trainerName: string, googleSynced: boolean): string {
  const name = firstName(trainerName);
  if (googleSynced) return `Added to ${name}'s calendar`;
  return `Shows in ${name}'s calendar on the next refresh`;
}

export function sessionSummary(personName: string): string {
  return `Session with ${firstName(personName)}`;
}

export function isGoogleConfigured(env: { clientId?: string | null; clientSecret?: string | null }): boolean {
  return Boolean(env.clientId?.trim() && env.clientSecret?.trim());
}

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

export type AvailabilityBlock = {
  id?: string;
  weekday: number | null;
  overrideDate: string | null;
  startMinute: number;
  endMinute: number;
  available: boolean;
};

export type TimeRange = {
  startsAt: string;
  endsAt: string;
};

export type OpenSlot = TimeRange & {
  startMinute: number;
  endMinute: number;
};

export type ZonedParts = CivilDate & {
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAY_INDEX[bag.weekday] ?? 0,
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

/** Wall-clock time in `timeZone` to a UTC instant. Evening slots stay unambiguous across DST. */
export function zonedTimeToUtc(
  day: CivilDate,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(day.year, day.month - 1, day.day, hour, minute, 0);
  const first = offsetMs(new Date(guess), timeZone);
  let utc = guess - first;
  const second = offsetMs(new Date(utc), timeZone);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

export function civilFromParts(parts: Pick<ZonedParts, "year" | "month" | "day">): CivilDate {
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function civilToKey(day: CivilDate): string {
  const month = String(day.month).padStart(2, "0");
  const date = String(day.day).padStart(2, "0");
  return `${day.year}-${month}-${date}`;
}

export function keyToCivil(key: string): CivilDate {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

export function addDays(day: CivilDate, days: number): CivilDate {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + days, 12));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function weekdayOf(day: CivilDate): number {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

export function startOfWeekMonday(date: Date, timeZone: string): CivilDate {
  const parts = zonedParts(date, timeZone);
  const day = civilFromParts(parts);
  const weekday = weekdayOf(day);
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDays(day, -back);
}

export function weekDays(weekStart: CivilDate): CivilDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function minutesToClock(minute: number): { hour: number; minute: number; suffix: "AM" | "PM" } {
  const hour24 = Math.floor(minute / 60) % 24;
  const mins = minute % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour, minute: mins, suffix };
}

export function formatMinute(minute: number): string {
  const clock = minutesToClock(minute);
  return `${clock.hour}:${String(clock.minute).padStart(2, "0")} ${clock.suffix}`;
}

/** "5:00 to 8:00 PM" when both sides share a meridiem. */
export function formatMinuteRange(startMinute: number, endMinute: number): string {
  const start = minutesToClock(startMinute);
  const end = minutesToClock(endMinute);
  const endLabel = `${end.hour}:${String(end.minute).padStart(2, "0")} ${end.suffix}`;
  if (start.suffix === end.suffix) {
    return `${start.hour}:${String(start.minute).padStart(2, "0")} to ${endLabel}`;
  }
  return `${formatMinute(startMinute)} to ${endLabel}`;
}

export function formatInstant(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  return formatMinute(parts.hour * 60 + parts.minute);
}

export function formatCivil(day: CivilDate, options?: { weekday?: boolean }): string {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: options?.weekday === false ? undefined : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  return formatted.replace(/,/g, "");
}

export function formatWeekLabel(weekStart: CivilDate): string {
  const end = addDays(weekStart, 6);
  const startLabel = formatCivil(weekStart, { weekday: false });
  const endLabel =
    weekStart.month === end.month ? String(end.day) : formatCivil(end, { weekday: false });
  return `Week of ${startLabel} to ${endLabel}`;
}

export function formatWeekdayShort(day: CivilDate): string {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

export function blocksForDay(day: CivilDate, blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  const key = civilToKey(day);
  const overrides = blocks.filter((block) => block.overrideDate === key);
  if (overrides.length > 0) return overrides;
  const weekday = weekdayOf(day);
  return blocks.filter((block) => block.overrideDate == null && block.weekday === weekday);
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Open slots for the client book tab. The client's own booking stays in the
 * blocked ranges, so that time is not offered again.
 */
export function clientOpenSlots(input: {
  day: CivilDate;
  timeZone: string;
  blocks: AvailabilityBlock[];
  slotMinutes: number;
  taken: TimeRange[];
  ownBooked: TimeRange[];
  now?: Date;
}): OpenSlot[] {
  return openSlots({
    day: input.day,
    timeZone: input.timeZone,
    blocks: input.blocks,
    slotMinutes: input.slotMinutes,
    booked: [...input.taken, ...input.ownBooked],
    now: input.now,
  });
}

export function openSlots(input: {
  day: CivilDate;
  timeZone: string;
  blocks: AvailabilityBlock[];
  slotMinutes: number;
  booked: TimeRange[];
  now?: Date;
}): OpenSlot[] {
  const now = input.now ?? new Date();
  const slots: OpenSlot[] = [];
  for (const block of blocksForDay(input.day, input.blocks)) {
    if (!block.available) continue;
    for (
      let minute = block.startMinute;
      minute + input.slotMinutes <= block.endMinute;
      minute += input.slotMinutes
    ) {
      const start = zonedTimeToUtc(input.day, Math.floor(minute / 60), minute % 60, input.timeZone);
      const end = new Date(start.getTime() + input.slotMinutes * 60_000);
      const range = { startsAt: start.toISOString(), endsAt: end.toISOString() };
      if (start.getTime() <= now.getTime()) continue;
      if (input.booked.some((booked) => rangesOverlap(range, booked))) continue;
      slots.push({ ...range, startMinute: minute, endMinute: minute + input.slotMinutes });
    }
  }
  return slots;
}

export function clientCanCancel(startsAt: string, cutoffHours: number, now = new Date()): boolean {
  const start = new Date(startsAt).getTime();
  return start - now.getTime() >= cutoffHours * 3_600_000;
}

export type IcsEventInput = {
  uid: string;
  startsAt: string;
  endsAt: string;
  summary: string;
  description: string;
  status: "confirmed" | "cancelled";
};

function icsStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** RFC 5545 folds at 75 octets. A continuation line starts with one space. */
function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let budget = 75;
  for (const character of line) {
    const next = Buffer.byteLength(character, "utf8");
    if (current && Buffer.byteLength(current, "utf8") + next > budget) {
      parts.push(current);
      current = character;
      budget = 74;
    } else {
      current += character;
    }
  }
  if (current) parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

export function buildIcs(calendarName: string, events: IcsEventInput[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cleat//Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-PUBLISHED-TTL:PT60S",
  ];
  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}@cleat`);
    lines.push(`DTSTAMP:${icsStamp(now.toISOString())}`);
    lines.push(`DTSTART:${icsStamp(event.startsAt)}`);
    lines.push(`DTEND:${icsStamp(event.endsAt)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push(`STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map((line) => foldIcsLine(line)).join("\r\n")}\r\n`;
}

export function googleEventBody(input: {
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
}): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: "UTC" };
  end: { dateTime: string; timeZone: "UTC" };
} {
  return {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt, timeZone: "UTC" },
    end: { dateTime: input.endsAt, timeZone: "UTC" },
  };
}

const availabilityRowSchema = z.object({
  id: z.uuid(),
  weekday: z.number().int().nullable(),
  override_date: z.string().nullable(),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  available: z.boolean(),
});

const sessionRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  trainer_id: z.uuid(),
  client_id: z.uuid(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(["booked", "cancelled"]),
  cancelled_at: z.string().nullable(),
  cancelled_by: z.uuid().nullable(),
  google_event_id: z.string().nullable().optional(),
});

export type SessionRecord = {
  id: string;
  orgId: string;
  trainerId: string;
  clientId: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "cancelled";
  cancelledAt: string | null;
  cancelledBy: string | null;
  googleEventId: string | null;
};

export function parseAvailability(data: unknown): AvailabilityBlock[] {
  const rows = z.array(availabilityRowSchema).safeParse(data ?? []);
  if (!rows.success) return [];
  return rows.data.map((row) => ({
    id: row.id,
    weekday: row.weekday,
    overrideDate: row.override_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    available: row.available,
  }));
}

export function parseSessions(data: unknown): SessionRecord[] {
  const rows = z.array(sessionRowSchema).safeParse(data ?? []);
  if (!rows.success) return [];
  return rows.data.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    googleEventId: row.google_event_id ?? null,
  }));
}

export type WeeklyDraft = {
  weekday: number;
  available: boolean;
  startMinute: number;
  endMinute: number;
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Editor order matches the week grid: Monday through Sunday. */
export const EDITOR_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export function defaultWeeklyDraft(): WeeklyDraft[] {
  return EDITOR_WEEKDAYS.map((weekday) => ({
    weekday,
    available: weekday >= 1 && weekday <= 5,
    startMinute: 17 * 60,
    endMinute: 20 * 60,
  }));
}

export function draftFromBlocks(blocks: AvailabilityBlock[]): WeeklyDraft[] {
  const defaults = defaultWeeklyDraft();
  return defaults.map((draft) => {
    const saved = blocks.find((block) => block.overrideDate == null && block.weekday === draft.weekday);
    if (!saved) return draft;
    return {
      weekday: draft.weekday,
      available: saved.available,
      startMinute: saved.startMinute,
      endMinute: saved.endMinute,
    };
  });
}

export function minuteFromTimeInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function timeInputFromMinute(minute: number): string {
  const hour = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
