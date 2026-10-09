import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { keyToCivil, zonedTimeToUtc } from "./calendar";
import {
  DEFAULT_UNANSWERED_HOURS,
  buildInboxQueue,
  filterInbox,
  inboxAge,
  inboxCopy,
  inboxReasonCounts,
  missedCandidates,
  parseUnansweredHours,
  resolveUnansweredHours,
  selectInboxItem,
  sortInboxItems,
  unansweredHoursOrDefault,
  whyEscalated,
  type StoredInboxItem,
} from "./inbox";
import type { BoardRow } from "./program";

const DASH = /[—–]| - /;

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SAM = "22222222-2222-4222-8222-222222222222";
const JORDAN = "33333333-3333-4333-8333-333333333333";

function stored(partial: Partial<StoredInboxItem> & Pick<StoredInboxItem, "id" | "priority" | "createdAt">): StoredInboxItem {
  return {
    orgId: ORG,
    clientId: SAM,
    auditId: null,
    messageId: null,
    emergency: false,
    reasonCodes: [],
    title: partial.priority,
    preview: "Preview",
    templateId: null,
    status: "open",
    ...partial,
  };
}

function names(): Record<string, string> {
  return { [SAM]: "Sam Lee", [JORDAN]: "Jordan Kim" };
}

test("emergency P0 sorts ahead of an older injury P0, then P1 P2 P3, oldest first", () => {
  const items = sortInboxItems([
    stored({
      id: "10000000-0000-4000-8000-000000000004",
      priority: "p3",
      createdAt: "2026-10-09T06:00:00.000Z",
      reasonCodes: ["missed"],
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000003",
      priority: "p2",
      createdAt: "2026-10-09T07:00:00.000Z",
      reasonCodes: ["unanswered"],
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000002",
      priority: "p1",
      clientId: JORDAN,
      createdAt: "2026-10-09T09:00:00.000Z",
      reasonCodes: ["program_swap"],
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000006",
      priority: "p1",
      createdAt: "2026-10-09T08:00:00.000Z",
      reasonCodes: ["asks_for_coach"],
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000001",
      priority: "p0",
      emergency: false,
      createdAt: "2026-10-09T05:00:00.000Z",
      reasonCodes: ["refusal_keyword"],
      templateId: "medical_safety",
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000005",
      priority: "p0",
      emergency: true,
      createdAt: "2026-10-09T11:00:00.000Z",
      reasonCodes: ["emergency"],
      templateId: "emergency",
    }),
    stored({
      id: "10000000-0000-4000-8000-000000000007",
      priority: "p0",
      emergency: true,
      createdAt: "2026-10-09T04:00:00.000Z",
      reasonCodes: ["self_harm", "emergency"],
      templateId: "emergency_self_harm",
    }),
  ]);
  assert.deepEqual(
    items.map((item) => item.id.slice(-1)),
    ["7", "5", "1", "6", "2", "3", "4"],
  );
});

test("the unanswered window defaults to 4 hours and a change moves the cutoff", () => {
  assert.equal(DEFAULT_UNANSWERED_HOURS, 4);
  assert.equal(unansweredHoursOrDefault(undefined), 4);
  assert.equal(unansweredHoursOrDefault("4"), 4);
  assert.equal(parseUnansweredHours(0), null);
  assert.equal(parseUnansweredHours(169), null);
  assert.equal(parseUnansweredHours(2), 2);

  const now = "2026-10-09T12:00:00.000Z";
  const head = {
    threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clientId: SAM,
    messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    senderId: SAM,
    body: "Did you see my note about Friday?",
    createdAt: "2026-10-09T08:00:01.000Z",
  };
  const exact = { ...head, createdAt: "2026-10-09T08:00:00.000Z" };
  const base = {
    orgId: ORG,
    now,
    names: names(),
    stored: [],
    drafts: [],
    audits: [],
    missed: [],
  };
  assert.equal(buildInboxQueue({ ...base, windowHours: 4, heads: [head] }).length, 0);
  const atFour = buildInboxQueue({ ...base, windowHours: 4, heads: [exact] });
  assert.equal(atFour.length, 1);
  assert.equal(atFour[0]?.priority, "p2");
  assert.equal(atFour[0]?.reason, "unanswered");
  assert.equal(atFour[0]?.derived, true);

  const threeHours = { ...head, createdAt: "2026-10-09T09:00:00.000Z" };
  assert.equal(buildInboxQueue({ ...base, windowHours: 4, heads: [threeHours] }).length, 0);
  assert.equal(buildInboxQueue({ ...base, windowHours: 2, heads: [threeHours] }).length, 1);

  const fiveHours = { ...head, createdAt: "2026-10-09T07:00:00.000Z" };
  assert.equal(buildInboxQueue({ ...base, windowHours: 4, heads: [fiveHours] }).length, 1);
  assert.equal(buildInboxQueue({ ...base, windowHours: 8, heads: [fiveHours] }).length, 0);
});

test("reason chip counts match the open items and a filter keeps that reason", () => {
  const queue = buildInboxQueue({
    orgId: ORG,
    now: "2026-10-09T12:00:00.000Z",
    windowHours: 4,
    names: names(),
    stored: [
      stored({
        id: "10000000-0000-4000-8000-000000000011",
        priority: "p0",
        emergency: true,
        createdAt: "2026-10-09T10:00:00.000Z",
        reasonCodes: ["emergency"],
        messageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
      stored({
        id: "10000000-0000-4000-8000-000000000012",
        priority: "p0",
        emergency: false,
        createdAt: "2026-10-09T09:00:00.000Z",
        reasonCodes: ["refusal_keyword"],
        clientId: JORDAN,
      }),
      stored({
        id: "10000000-0000-4000-8000-000000000013",
        priority: "p1",
        createdAt: "2026-10-09T08:00:00.000Z",
        reasonCodes: ["asks_for_coach"],
        auditId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      }),
      stored({
        id: "10000000-0000-4000-8000-000000000014",
        priority: "p1",
        createdAt: "2026-10-09T07:00:00.000Z",
        reasonCodes: ["program_swap"],
        clientId: JORDAN,
        status: "sent",
      }),
    ],
    drafts: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        inboxItemId: "10000000-0000-4000-8000-000000000013",
        text: "Thursday can move to Friday.",
        sources: [{ title: "Rest days", articleId: null }],
        status: "held",
      },
    ],
    audits: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        confidence: 0.62,
        threshold: 0.85,
        templateId: null,
        reasonCodes: ["asks_for_coach"],
      },
    ],
    heads: [
      {
        threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        clientId: SAM,
        messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        senderId: SAM,
        body: "Still waiting",
        createdAt: "2026-10-09T07:00:00.000Z",
      },
    ],
    missed: [
      {
        clientId: JORDAN,
        displayName: "Jordan Kim",
        summary: "Lower A · no log yet",
        occurredAt: "2026-10-08T00:00:00.000Z",
        nudgeKind: "nudge",
      },
    ],
  });
  const counts = inboxReasonCounts(queue);
  assert.deepEqual(counts, {
    emergency: 1,
    injury: 1,
    ai_escalate: 1,
    unanswered: 1,
    missed: 1,
  });
  assert.equal(queue.filter((item) => item.reason === "ai_escalate")[0]?.draft?.text, "Thursday can move to Friday.");
  assert.equal(queue.find((item) => item.reason === "ai_escalate")?.confidence, 0.62);
  assert.equal(queue.find((item) => item.reason === "injury")?.draft, null);
  assert.equal(filterInbox(queue, "emergency").length, 1);
  assert.equal(filterInbox(queue, "all").length, queue.length);
  const selected = selectInboxItem(queue, { client: JORDAN, focus: "missed" });
  assert.equal(selected?.reason, "missed");
  assert.equal(selected?.clientName, "Jordan Kim");
});

test("a sent inbox row does not stop the unanswered clock until a coach reply reaches the client", () => {
  const messageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const trainer = "11111111-1111-4111-8111-111111111111";
  const now = "2026-10-09T12:00:00.000Z";
  const head = {
    threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clientId: SAM,
    messageId,
    senderId: SAM,
    body: "Hello",
    createdAt: "2026-10-09T06:00:00.000Z",
  };
  const base = {
    orgId: ORG,
    now,
    windowHours: 4,
    names: names(),
    drafts: [],
    audits: [],
    missed: [],
  };
  const sentOnly = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: "10000000-0000-4000-8000-000000000021",
        priority: "p2",
        status: "sent",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["unanswered"],
      }),
    ],
    heads: [head],
  });
  assert.equal(sentOnly.some((item) => item.reason === "unanswered" && item.messageId === messageId), true);

  const reached = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: "10000000-0000-4000-8000-000000000021",
        priority: "p2",
        status: "sent",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["unanswered"],
      }),
    ],
    heads: [
      {
        ...head,
        messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccc99",
        senderId: trainer,
        body: "I saw this.",
        createdAt: "2026-10-09T07:00:00.000Z",
      },
    ],
  });
  assert.equal(reached.some((item) => item.reason === "unanswered"), false);
});

test("a dismissed or pending held draft does not stop the unanswered clock", () => {
  const now = "2026-10-09T12:00:00.000Z";
  const messageId = "cccccccc-cccc-4ccc-8ccc-cccccccccc41";
  const itemId = "10000000-0000-4000-8000-000000000041";
  const trainer = "11111111-1111-4111-8111-111111111111";
  const head = {
    threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clientId: SAM,
    messageId,
    senderId: SAM,
    body: "Can I talk to you about Friday?",
    createdAt: "2026-10-09T06:00:00.000Z",
  };
  const draft = {
    id: "ffffffff-ffff-4fff-8fff-ffffffffff41",
    inboxItemId: itemId,
    text: "Friday works.",
    sources: [] as { title: string; articleId: string | null }[],
    status: "held" as const,
  };
  const base = {
    orgId: ORG,
    now,
    windowHours: 4,
    names: names(),
    audits: [],
    missed: [],
  };
  const pending = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: itemId,
        priority: "p1",
        status: "open",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["asks_for_coach"],
      }),
    ],
    drafts: [draft],
    heads: [head],
  });
  assert.equal(pending.some((item) => item.priority === "p1" && item.id === itemId), true);
  assert.equal(pending.some((item) => item.reason === "unanswered" && item.messageId === messageId), true);

  const dismissed = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: itemId,
        priority: "p1",
        status: "dismissed",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["asks_for_coach"],
      }),
    ],
    drafts: [{ ...draft, status: "dismissed" }],
    heads: [head],
  });
  assert.equal(dismissed.some((item) => item.priority === "p1"), false);
  assert.equal(dismissed.some((item) => item.reason === "unanswered" && item.messageId === messageId), true);

  const coachReply = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: itemId,
        priority: "p1",
        status: "dismissed",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["asks_for_coach"],
      }),
    ],
    drafts: [{ ...draft, status: "dismissed" }],
    heads: [{ ...head, messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccc42", senderId: trainer, body: "Friday works." }],
  });
  assert.equal(coachReply.some((item) => item.reason === "unanswered"), false);

  const pendingThenReply = buildInboxQueue({
    ...base,
    stored: [
      stored({
        id: itemId,
        priority: "p1",
        status: "open",
        messageId,
        createdAt: "2026-10-09T06:00:00.000Z",
        reasonCodes: ["asks_for_coach"],
      }),
    ],
    drafts: [draft],
    heads: [
      { ...head, messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccc43", senderId: trainer, body: "I saw this.", createdAt: "2026-10-09T07:00:00.000Z" },
    ],
  });
  assert.equal(pendingThenReply.some((item) => item.priority === "p1"), true);
  assert.equal(pendingThenReply.some((item) => item.reason === "unanswered"), false);
});

test("INBOX_UNANSWERED_HOURS defaults to 4, clamps from 1 to 168, and the org setting overrides it", () => {
  assert.equal(resolveUnansweredHours(undefined, undefined), 4);
  assert.equal(resolveUnansweredHours(null, ""), 4);
  assert.equal(resolveUnansweredHours(undefined, "nope"), 4);
  assert.equal(resolveUnansweredHours(undefined, "1"), 1);
  assert.equal(resolveUnansweredHours(undefined, "0"), 1);
  assert.equal(resolveUnansweredHours(undefined, "169"), 168);
  assert.equal(resolveUnansweredHours(undefined, "1.2"), 1);
  assert.equal(resolveUnansweredHours(undefined, "1.5"), 2);
  assert.equal(resolveUnansweredHours(6, "1"), 6);
  assert.equal(resolveUnansweredHours("8", "1"), 8);
  assert.equal(resolveUnansweredHours(0, "3"), 3);

  const now = "2026-10-09T12:00:00.000Z";
  const head = {
    threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clientId: SAM,
    messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccc51",
    senderId: SAM,
    body: "Still here",
    createdAt: "2026-10-09T10:30:00.000Z",
  };
  const base = {
    orgId: ORG,
    now,
    names: names(),
    stored: [],
    drafts: [],
    audits: [],
    heads: [head],
    missed: [],
  };
  assert.equal(buildInboxQueue({ ...base, windowHours: resolveUnansweredHours(undefined, "1") }).length, 1);
  assert.equal(buildInboxQueue({ ...base, windowHours: resolveUnansweredHours(4, "1") }).length, 0);
  assert.equal(buildInboxQueue({ ...base, windowHours: resolveUnansweredHours(undefined, "0") }).length, 1);
  assert.equal(buildInboxQueue({ ...base, windowHours: resolveUnansweredHours(undefined, "200") }).length, 0);
});

test("a low confidence hold explains why it was held", () => {
  assert.deepEqual(whyEscalated(["low_confidence"]), [inboxCopy.lowConfidence]);
  assert.equal(inboxCopy.lowConfidence, "Confidence below your threshold");
  const queue = buildInboxQueue({
    orgId: ORG,
    now: "2026-10-09T12:00:00.000Z",
    windowHours: 4,
    names: names(),
    stored: [
      stored({
        id: "10000000-0000-4000-8000-000000000031",
        priority: "p1",
        createdAt: "2026-10-09T11:00:00.000Z",
        reasonCodes: [],
      }),
    ],
    drafts: [],
    audits: [],
    heads: [],
    missed: [],
  });
  assert.deepEqual(queue[0]?.why, ["Confidence below your threshold"]);
});

test("missed age uses the client local day, not UTC midnight", () => {
  const row: BoardRow = {
    userId: JORDAN,
    displayName: "Jordan Kim",
    weightUnit: "lb",
    today: "missed",
    todayLabel: "Missed",
    summary: "Lower A",
    adherence: "0/1",
    lastLogged: "Oct 7",
    reasons: ["missed_yesterday"],
    needsNudge: true,
    action: "send",
    urgency: 0,
  };
  const occurred = missedCandidates([row], "2026-10-09", "America/Chicago")[0]?.occurredAt;
  const localStart = zonedTimeToUtc(keyToCivil("2026-10-08"), 0, 0, "America/Chicago").toISOString();
  const nextLocalMidnight = zonedTimeToUtc(keyToCivil("2026-10-09"), 0, 0, "America/Chicago").toISOString();
  assert.equal(occurred, localStart);
  assert.notEqual(occurred, "2026-10-08T00:00:00.000Z");
  assert.equal(inboxAge(occurred ?? "", nextLocalMidnight), "24h ago");
  assert.notEqual(inboxAge("2026-10-08T00:00:00.000Z", nextLocalMidnight), "24h ago");
});

test("inbox copy has no dash punctuation", () => {
  for (const value of Object.values(inboxCopy)) {
    assert.doesNotMatch(value, DASH);
  }
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../db/supabase/migrations/0007_inbox.sql"),
    "utf8",
  );
  assert.equal(sql.includes(inboxCopy.signIn), true);
  assert.equal(sql.includes(inboxCopy.emptyReply), true);
  assert.equal(sql.includes(inboxCopy.notOpen), true);
  assert.equal(sql.includes(inboxCopy.useDraft), true);
  assert.equal(sql.includes(inboxCopy.badTier), true);
  assert.doesNotMatch(sql, /[—–]/);
});
