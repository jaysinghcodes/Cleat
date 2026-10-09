import assert from "node:assert/strict";
import { test } from "node:test";
import { clampUnansweredHours } from "@cleat/domain";
import type { CleatClient } from "./supabase";
import { loadTrainerInbox } from "./ai-desk";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const EMERGENCY = "10000000-0000-4000-8000-0000000000e1";

type Filter = { op: string; column: string; value: unknown };

type Query = {
  table: string;
  filters: Filter[];
  limit: number | null;
};

function row(index: number) {
  const hex = index.toString(16).padStart(12, "0");
  return {
    id: `20000000-0000-4000-8000-${hex}`,
    org_id: ORG,
    client_id: CLIENT,
    audit_id: null,
    message_id: `30000000-0000-4000-8000-${hex}`,
    priority: "p1",
    emergency: false,
    reason_codes: ["auto_send_off"],
    title: "Resolved",
    preview: "old note",
    template_id: null,
    status: "sent",
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  };
}

const emergency = {
  id: EMERGENCY,
  org_id: ORG,
  client_id: CLIENT,
  audit_id: null,
  message_id: "40000000-0000-4000-8000-0000000000e1",
  priority: "p0",
  emergency: true,
  reason_codes: ["emergency"],
  title: "Emergency",
  preview: "Chest pain during the warmup",
  template_id: "emergency",
  status: "open",
  created_at: "2026-10-09T15:00:00.000Z",
};

function payload(query: Query): { data: unknown; error: null } {
  if (query.table === "orgs") return { data: { unanswered_hours: 4 }, error: null };
  if (query.table !== "inbox_items") return { data: [], error: null };
  const openOnly = query.filters.some((filter) => filter.op === "eq" && filter.column === "status" && filter.value === "open");
  const resolved = Array.from({ length: 300 }, (_, index) => row(index + 1));
  if (openOnly) {
    if (query.limit !== null && query.limit <= 300) return { data: [], error: null };
    return { data: [emergency], error: null };
  }
  const oldest = [...resolved, emergency].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { data: oldest.slice(0, query.limit ?? oldest.length), error: null };
}

function client(): { supabase: CleatClient; queries: Query[] } {
  const queries: Query[] = [];
  const supabase = {
    from(table: string) {
      const query: Query = { table, filters: [], limit: null };
      queries.push(query);
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          query.filters.push({ op: "eq", column, value });
          return api;
        },
        neq(column: string, value: unknown) {
          query.filters.push({ op: "neq", column, value });
          return api;
        },
        in() {
          return api;
        },
        order() {
          return api;
        },
        limit(value: number) {
          query.limit = value;
          return api;
        },
        maybeSingle() {
          return Promise.resolve(payload(query));
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(payload(query)).then(resolve, reject);
        },
      };
      return api;
    },
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
  };
  return { supabase: supabase as unknown as CleatClient, queries };
}

test("an open emergency stays visible after more than 300 resolved items", async () => {
  const { supabase, queries } = client();
  const inbox = await loadTrainerInbox(supabase, {
    orgId: ORG,
    timeZone: "America/Chicago",
    now: "2026-10-09T16:00:00.000Z",
  });
  const openQuery = queries.find(
    (query) =>
      query.table === "inbox_items" &&
      query.filters.some((filter) => filter.op === "eq" && filter.column === "status" && filter.value === "open"),
  );
  assert.ok(openQuery);
  assert.equal(openQuery.limit, null);
  assert.equal(inbox.items.some((item) => item.id === EMERGENCY && item.priority === "p0" && item.emergency), true);
  assert.equal(inbox.items.some((item) => item.preview === "old note"), false);
  assert.equal(
    queries.some(
      (query) =>
        query.table === "inbox_items" &&
        query.filters.some((filter) => filter.op === "eq" && filter.column === "status" && filter.value === "sent"),
    ),
    false,
  );
});

test("loadTrainerInbox uses the passed default unless the org saved a window", async () => {
  const messageId = "30000000-0000-4000-8000-0000000000aa";
  const head = {
    thread_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    client_id: CLIENT,
    message_id: messageId,
    sender_id: CLIENT,
    body: "Did you see my note?",
    created_at: "2026-10-09T14:30:00.000Z",
  };

  function desk(unansweredHours: unknown) {
    const queries: Query[] = [];
    const supabase = {
      from(table: string) {
        const query: Query = { table, filters: [], limit: null };
        queries.push(query);
        const api = {
          select() {
            return api;
          },
          eq(column: string, value: unknown) {
            query.filters.push({ op: "eq", column, value });
            return api;
          },
          neq(column: string, value: unknown) {
            query.filters.push({ op: "neq", column, value });
            return api;
          },
          in() {
            return api;
          },
          order() {
            return api;
          },
          limit(value: number) {
            query.limit = value;
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

  async function hours(unansweredHours: unknown, defaultWindowHours?: number) {
    return loadTrainerInbox(desk(unansweredHours), {
      orgId: ORG,
      timeZone: "America/Chicago",
      now: "2026-10-09T16:00:00.000Z",
      defaultWindowHours,
    });
  }

  const fromDefault = await hours(null, 1);
  assert.equal(fromDefault.windowHours, 1);
  assert.equal(fromDefault.items.some((item) => item.reason === "unanswered" && item.messageId === messageId), true);

  const orgWins = await hours(4, 1);
  assert.equal(orgWins.windowHours, 4);
  assert.equal(orgWins.items.some((item) => item.reason === "unanswered"), false);

  const fallback = await hours(null, undefined);
  assert.equal(fallback.windowHours, 4);
  assert.equal(fallback.items.some((item) => item.reason === "unanswered"), false);
});

test("a null org row with env 1 shows a 2 hour old message as P2 and a saved org value wins", async () => {
  const messageId = "30000000-0000-4000-8000-0000000000bb";
  const envWindow = clampUnansweredHours("1");
  assert.equal(envWindow, 1);
  const head = {
    thread_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    client_id: CLIENT,
    message_id: messageId,
    sender_id: CLIENT,
    body: "Still waiting on Friday",
    created_at: "2026-10-09T14:00:00.000Z",
  };

  function row(unansweredHours: unknown) {
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

  const open = await loadTrainerInbox(row(null), {
    orgId: ORG,
    timeZone: "America/Chicago",
    now: "2026-10-09T16:00:00.000Z",
    defaultWindowHours: envWindow ?? undefined,
  });
  assert.equal(open.windowHours, 1);
  assert.equal(open.items.some((item) => item.reason === "unanswered" && item.priority === "p2" && item.messageId === messageId), true);

  const saved = await loadTrainerInbox(row(4), {
    orgId: ORG,
    timeZone: "America/Chicago",
    now: "2026-10-09T16:00:00.000Z",
    defaultWindowHours: envWindow ?? undefined,
  });
  assert.equal(saved.windowHours, 4);
  assert.equal(saved.items.some((item) => item.reason === "unanswered"), false);
});
