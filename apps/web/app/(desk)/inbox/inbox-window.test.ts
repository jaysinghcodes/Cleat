import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadTrainerInbox, type CleatClient } from "@cleat/api";
import { serverInboxWindowHours } from "./inbox-window";

const here = dirname(fileURLToPath(import.meta.url));
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "30000000-0000-4000-8000-0000000000aa";

function desk(unansweredHours: unknown) {
  const head = {
    thread_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    client_id: CLIENT,
    message_id: MESSAGE,
    sender_id: CLIENT,
    body: "Did you see my note?",
    created_at: "2026-10-09T14:30:00.000Z",
  };
  const supabase = {
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        neq() {
          return api;
        },
        in() {
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return api;
        },
        maybeSingle() {
          if (table === "orgs") return Promise.resolve({ data: { unanswered_hours: unansweredHours }, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return api;
    },
    rpc() {
      return Promise.resolve({ data: [head], error: null });
    },
  };
  return supabase as unknown as CleatClient;
}

test("the inbox server resolves INBOX_UNANSWERED_HOURS and passes that number to the loader", async () => {
  const previous = process.env.INBOX_UNANSWERED_HOURS;
  try {
    process.env.INBOX_UNANSWERED_HOURS = "1";
    const fromEnv = serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS);
    assert.equal(fromEnv, 1);
    const open = await loadTrainerInbox(desk(null), {
      orgId: ORG,
      timeZone: "America/Chicago",
      now: "2026-10-09T16:00:00.000Z",
      defaultWindowHours: fromEnv,
    });
    assert.equal(open.windowHours, 1);
    assert.equal(open.items.some((item) => item.reason === "unanswered" && item.messageId === MESSAGE), true);

    const orgWins = await loadTrainerInbox(desk(4), {
      orgId: ORG,
      timeZone: "America/Chicago",
      now: "2026-10-09T16:00:00.000Z",
      defaultWindowHours: fromEnv,
    });
    assert.equal(orgWins.windowHours, 4);
    assert.equal(orgWins.items.some((item) => item.reason === "unanswered"), false);

    process.env.INBOX_UNANSWERED_HOURS = "0";
    assert.equal(serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS), 1);
    process.env.INBOX_UNANSWERED_HOURS = "999";
    assert.equal(serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS), 168);
    process.env.INBOX_UNANSWERED_HOURS = "nope";
    assert.equal(serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS), 4);
    delete process.env.INBOX_UNANSWERED_HOURS;
    assert.equal(serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS), 4);

    const page = readFileSync(join(here, "page.tsx"), "utf8");
    const deskSource = readFileSync(join(here, "inbox-desk.tsx"), "utf8");
    const helper = readFileSync(join(here, "inbox-window.ts"), "utf8");
    const api = readFileSync(join(here, "../../../../../packages/api/src/ai-desk.ts"), "utf8");
    assert.equal(page.includes("use client"), false);
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /serverInboxWindowHours\(process\.env\.INBOX_UNANSWERED_HOURS\)/);
    assert.match(page, /<InboxDesk defaultWindowHours=\{defaultWindowHours\} \/>/);
    assert.equal(deskSource.includes("INBOX_UNANSWERED_HOURS"), false);
    assert.match(deskSource, /defaultWindowHours/);
    assert.equal(helper.includes("INBOX_UNANSWERED_HOURS"), false);
    assert.equal(api.includes("INBOX_UNANSWERED_HOURS"), false);
    assert.equal(api.includes("process.env"), false);
  } finally {
    if (previous === undefined) delete process.env.INBOX_UNANSWERED_HOURS;
    else process.env.INBOX_UNANSWERED_HOURS = previous;
  }
});
