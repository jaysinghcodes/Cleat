import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingCopy, chatCopy, copy, programCopy } from "@cleat/domain";
import { CleatRequestError } from "./auth";
import { bookSession, loadTrainerCalendar } from "./calendar";
import { sendChatMessage } from "./messages";
import { fetchClientTraining } from "./programs";
import type { CleatClient } from "./supabase";

const USER = "22222222-2222-4222-8222-222222222222";

function sessionClient(): CleatClient {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
  } as unknown as CleatClient;
}

test("chat send hides a raw fetch failure", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "TypeError: fetch failed\n    at sendChatMessage (messages.ts:1:1)" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      () => sendChatMessage(sessionClient(), "http://desk.test", { body: "Hello" }),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, chatCopy.sendFailed);
        assert.equal(err.message.includes("messages.ts"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("booking hides a raw database failure and keeps a known slot message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: 'duplicate key value violates unique constraint "sessions_pkey"' }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      () => bookSession("http://desk.test", "token", "2026-10-10T15:00:00.000Z"),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, copy.generic);
        assert.equal(err.message.includes("sessions_pkey"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: bookingCopy.slotTaken }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      () => bookSession("http://desk.test", "token", "2026-10-10T15:00:00.000Z"),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, bookingCopy.slotTaken);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

const RAW_ERRORS = [
  "permission denied for table inbox_items",
  "Could not find the function public.book_slot(p_slot) in the schema cache",
  "column clients.foo does not exist",
  "JSON object requested, multiple (or no) rows returned",
  "AuthApiError: Invalid Refresh Token: Refresh Token Not Found",
  "canceling statement due to statement timeout",
  "insufficient_privilege",
  "Load failed",
  "TypeError: Failed to fetch",
] as const;

test("book session hides raw schema and auth failures", async () => {
  const original = globalThis.fetch;
  try {
    for (const raw of RAW_ERRORS) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: raw }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      await assert.rejects(
        () => bookSession("http://desk.test", "token", "2026-10-10T15:00:00.000Z"),
        (err: unknown) => {
          assert.ok(err instanceof CleatRequestError);
          assert.equal(err.message, copy.generic);
          assert.equal(err.message.includes(raw), false);
          return true;
        },
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("trainer calendar hides raw schema and auth failures", async () => {
  for (const raw of RAW_ERRORS) {
    const query = Promise.resolve({ data: null, error: { message: raw } });
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => query,
      maybeSingle: () => query,
      then: query.then.bind(query),
    };
    const client = { from: () => builder } as unknown as CleatClient;
    await assert.rejects(
      () => loadTrainerCalendar(client, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, copy.generic);
        assert.equal(err.message.includes(raw), false);
        return true;
      },
    );
  }
});

test("program load hides a raw JWT failure", async () => {
  const query = Promise.resolve({
    data: null,
    error: { message: "JWT expired: PGRST301" },
  });
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => query,
    in: () => query,
    maybeSingle: () => query,
    then: query.then.bind(query),
  };
  const client = {
    from: () => builder,
  } as unknown as CleatClient;

  await assert.rejects(
    () => fetchClientTraining(client, USER),
    (err: unknown) => {
      assert.ok(err instanceof CleatRequestError);
      assert.equal(err.message, programCopy.couldNotLog);
      assert.equal(err.message.includes("JWT"), false);
      assert.equal(err.message.includes("PGRST"), false);
      return true;
    },
  );
});
