import assert from "node:assert/strict";
import { test } from "node:test";
import ICAL from "ical.js";
import {
  ICS_CACHE_TTL_SECONDS,
  bookingCopy,
  buildIcs,
  clientCanCancel,
  clientOpenSlots,
  confirmationLine,
  formatInstant,
  formatMinuteRange,
  googleEventBody,
  isGoogleConfigured,
  openSlots,
  sessionSummary,
  zonedTimeToUtc,
  type AvailabilityBlock,
} from "./calendar";
import { signFeedToken, verifyFeedToken } from "./feed-token";

const SECRET = "local-test-ics-signing-secret";
const ZONE = "America/Chicago";

function assertNoDashPunctuation(value: string) {
  assert.equal(value.includes("\u2014"), false, value);
  assert.equal(value.includes("\u2013"), false, value);
  assert.equal(/\s-\s/.test(value), false, value);
}

const weekday = (weekday: number, startMinute: number, endMinute: number): AvailabilityBlock => ({
  weekday,
  overrideDate: null,
  startMinute,
  endMinute,
  available: true,
});

test("new slot math defaults and confirmation copy", () => {
  assert.equal(confirmationLine("Alex Rivera", false), "Shows in Alex's calendar on the next refresh");
  assert.equal(confirmationLine("Alex Rivera", true), "Added to Alex's calendar");
  assert.equal(isGoogleConfigured({ clientId: "", clientSecret: "" }), false);
  assert.equal(isGoogleConfigured({ clientId: "id", clientSecret: "" }), false);
  assert.equal(isGoogleConfigured({ clientId: "id", clientSecret: "secret" }), true);
  assert.equal(ICS_CACHE_TTL_SECONDS, 60);
  for (const value of Object.values(bookingCopy)) assertNoDashPunctuation(value);
  assertNoDashPunctuation(confirmationLine("Alex Rivera", false));
  assertNoDashPunctuation(confirmationLine("Alex Rivera", true));
});

test("Chicago wall times around the Nov 1 2026 DST change", () => {
  const before = zonedTimeToUtc({ year: 2026, month: 10, day: 30 }, 17, 0, ZONE);
  const after = zonedTimeToUtc({ year: 2026, month: 11, day: 1 }, 17, 0, ZONE);
  assert.equal(before.toISOString(), "2026-10-30T22:00:00.000Z");
  assert.equal(after.toISOString(), "2026-11-01T23:00:00.000Z");
  assert.equal(formatInstant(before.toISOString(), ZONE), "5:00 PM");
  assert.equal(formatInstant(after.toISOString(), ZONE), "5:00 PM");
  assert.equal(formatMinuteRange(17 * 60, 20 * 60), "5:00 to 8:00 PM");
});

test("slot length changes which starts are offered", () => {
  const blocks = [weekday(5, 17 * 60, 20 * 60)];
  const day = { year: 2026, month: 10, day: 30 };
  const now = new Date("2026-10-01T00:00:00.000Z");
  const hour = openSlots({ day, timeZone: ZONE, blocks, slotMinutes: 60, booked: [], now });
  const shorter = openSlots({ day, timeZone: ZONE, blocks, slotMinutes: 45, booked: [], now });
  assert.deepEqual(
    hour.map((slot) => formatInstant(slot.startsAt, ZONE)),
    ["5:00 PM", "6:00 PM", "7:00 PM"],
  );
  assert.equal(shorter.length, 4);
  assert.equal(formatInstant(shorter[1]!.startsAt, ZONE), "5:45 PM");
  const taken = openSlots({
    day,
    timeZone: ZONE,
    blocks,
    slotMinutes: 60,
    booked: [{ startsAt: hour[0]!.startsAt, endsAt: hour[0]!.endsAt }],
    now,
  });
  assert.equal(taken.length, 2);
  assert.equal(formatInstant(taken[0]!.startsAt, ZONE), "6:00 PM");
});

test("a client's own booking is not an open slot", () => {
  const blocks = [weekday(4, 7 * 60, 9 * 60)];
  const day = { year: 2026, month: 10, day: 8 };
  const now = new Date("2026-10-08T04:00:00.000Z");
  const start = zonedTimeToUtc(day, 7, 0, ZONE);
  const own = {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
  };
  const withOwnInTaken = clientOpenSlots({
    day,
    timeZone: ZONE,
    blocks,
    slotMinutes: 60,
    taken: [own],
    ownBooked: [own],
    now,
  });
  const ownRemovedFromTaken = clientOpenSlots({
    day,
    timeZone: ZONE,
    blocks,
    slotMinutes: 60,
    taken: [],
    ownBooked: [own],
    now,
  });
  assert.deepEqual(
    withOwnInTaken.map((slot) => formatInstant(slot.startsAt, ZONE)),
    ["8:00 AM"],
  );
  assert.deepEqual(
    ownRemovedFromTaken.map((slot) => formatInstant(slot.startsAt, ZONE)),
    ["8:00 AM"],
  );
});

test("a date override replaces the weekly window", () => {
  const day = { year: 2026, month: 11, day: 1 };
  const blocks: AvailabilityBlock[] = [
    weekday(0, 17 * 60, 20 * 60),
    {
      weekday: null,
      overrideDate: "2026-11-01",
      startMinute: 16 * 60,
      endMinute: 17 * 60,
      available: true,
    },
  ];
  const slots = openSlots({
    day,
    timeZone: ZONE,
    blocks,
    slotMinutes: 60,
    booked: [],
    now: new Date("2026-10-01T00:00:00.000Z"),
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0]!.startsAt, "2026-11-01T22:00:00.000Z");
  assert.equal(formatInstant(slots[0]!.startsAt, ZONE), "4:00 PM");
});

test("client cancel cutoff", () => {
  const starts = "2026-10-30T22:00:00.000Z";
  const early = new Date("2026-10-30T09:00:00.000Z");
  const late = new Date("2026-10-30T12:00:00.000Z");
  assert.equal(clientCanCancel(starts, 12, early), true);
  assert.equal(clientCanCancel(starts, 12, late), false);
  assert.equal(clientCanCancel(starts, 8, late), true);
});

test("ICS export parses and keeps Chicago local time across DST", () => {
  const before = "2026-10-30T22:00:00.000Z";
  const after = "2026-11-01T23:00:00.000Z";
  const ics = buildIcs("Cleat", [
    {
      uid: "11111111-1111-1111-1111-111111111111",
      startsAt: before,
      endsAt: "2026-10-30T23:00:00.000Z",
      summary: sessionSummary("Sam Lee"),
      description: bookingCopy.sessionDescription,
      status: "confirmed",
    },
    {
      uid: "22222222-2222-2222-2222-222222222222",
      startsAt: after,
      endsAt: "2026-11-02T00:00:00.000Z",
      summary: sessionSummary("Alex Rivera"),
      description: bookingCopy.sessionDescription,
      status: "cancelled",
    },
  ]);
  assert.match(ics, /X-PUBLISHED-TTL:PT60S/);
  assertNoDashPunctuation(sessionSummary("Sam Lee"));
  const component = new ICAL.Component(ICAL.parse(ics));
  const events = component.getAllSubcomponents("vevent").map((item) => new ICAL.Event(item));
  assert.equal(events.length, 2);
  assert.equal(events[0]!.summary, "Session with Sam");
  assert.equal(events[0]!.startDate.toJSDate().toISOString(), before);
  assert.equal(formatInstant(events[0]!.startDate.toJSDate().toISOString(), ZONE), "5:00 PM");
  assert.equal(events[1]!.startDate.toJSDate().toISOString(), after);
  assert.equal(formatInstant(events[1]!.startDate.toJSDate().toISOString(), ZONE), "5:00 PM");
  assert.equal(events[1]!.component.getFirstPropertyValue("status"), "CANCELLED");
  const folded = buildIcs("Cleat", [
    {
      uid: "33333333-3333-3333-3333-333333333333",
      startsAt: before,
      endsAt: "2026-10-30T23:00:00.000Z",
      summary: `Session with ${"é".repeat(80)}`,
      description: bookingCopy.sessionDescription,
      status: "confirmed",
    },
  ]);
  assert.equal(folded.replaceAll("\r\n", "").includes("\n"), false);
  assert.equal(folded.replaceAll("\r\n", "").includes("\r"), false);
  for (const line of folded.split("\r\n")) {
    if (!line) continue;
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, line);
  }
  const foldedEvent = new ICAL.Event(new ICAL.Component(ICAL.parse(folded)).getFirstSubcomponent("vevent"));
  assert.equal(foldedEvent.summary, `Session with ${"é".repeat(80)}`);
  const body = googleEventBody({
    summary: sessionSummary("Sam Lee"),
    description: bookingCopy.sessionDescription,
    startsAt: before,
    endsAt: "2026-10-30T23:00:00.000Z",
  });
  assert.equal(body.summary, "Session with Sam");
  assert.equal(body.start.timeZone, "UTC");
  assertNoDashPunctuation(body.summary);
  assertNoDashPunctuation(body.description);
});

test("feed tokens reject tampering and accept a signed value", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const nonce = "ab".repeat(32);
  const token = signFeedToken(userId, nonce, SECRET);
  assert.deepEqual(verifyFeedToken(`${token}.ics`, SECRET), { userId, nonce });
  assert.equal(verifyFeedToken(token.slice(0, -4) + "aaaa", SECRET), null);
  assert.equal(verifyFeedToken(token.replace(userId, "33333333-3333-3333-3333-333333333333"), SECRET), null);
  assert.equal(verifyFeedToken(token, "wrong-secret-value-here"), null);
  assert.equal(verifyFeedToken("not-a-token", SECRET), null);
});
