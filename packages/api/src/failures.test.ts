import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aiCopy,
  bookingCopy,
  chatCopy,
  clientSessionView,
  copy,
  deskSessionView,
  inboxCopy,
  programCopy,
  screenCopy,
  sessionLoadError,
  userFacingError,
} from "@cleat/domain";
import { CleatRequestError, fetchCoach, fetchMembership } from "./auth";
import { resolveInboxItem } from "./ai-desk";
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
      assert.equal(err.message, screenCopy.loadFailed);
      assert.notEqual(err.message, programCopy.couldNotLog);
      assert.equal(err.message.includes("JWT"), false);
      assert.equal(err.message.includes("PGRST"), false);
      return true;
    },
  );
});

test("a membership load failure shows the error state, not Checking your session", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "permission denied for table inbox_items" } }),
  } as unknown as CleatClient;
  let loadError = "";
  try {
    await fetchMembership(client);
    assert.fail("membership should fail");
  } catch (err) {
    loadError = sessionLoadError(err);
  }
  assert.equal(loadError, screenCopy.loadFailed);
  assert.equal(loadError.includes("permission denied"), false);
  assert.equal(loadError.includes("Checking your session"), false);
  const view = deskSessionView({
    ready: true,
    configured: true,
    hasSession: true,
    role: null,
    loadError,
  });
  assert.equal(view, "error");
  assert.notEqual(view, "signup");
  assert.notEqual(view, "login");
});

test("a coach load failure shows the error state, not the login redirect", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "TypeError: Failed to fetch" } }),
  } as unknown as CleatClient;
  let loadError = "";
  try {
    await fetchCoach(client);
    assert.fail("coach should fail");
  } catch (err) {
    loadError = sessionLoadError(err);
  }
  assert.equal(loadError, screenCopy.loadFailed);
  const view = clientSessionView({
    ready: true,
    configured: true,
    hasSession: true,
    role: "client",
    loadError,
  });
  assert.equal(view, "error");
});

const CALENDAR_SENTENCES = [
  "Calendar signing is not configured.",
  "Google Calendar is not configured.",
  "Only a coach can connect Google Calendar.",
  "Google did not return a calendar connection.",
] as const;

for (const sentence of CALENDAR_SENTENCES) {
  test(`calendar fail keeps ${sentence}`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: sentence }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    try {
      await assert.rejects(
        () => bookSession("http://desk.test", "token", "2026-10-10T15:00:00.000Z"),
        (err: unknown) => {
          assert.ok(err instanceof CleatRequestError);
          assert.equal(err.message, sentence);
          assert.equal(userFacingError(err.message, copy.generic), sentence);
          return true;
        },
      );
    } finally {
      globalThis.fetch = original;
    }
  });
}

const INBOX_SENTENCES = [
  inboxCopy.signIn,
  inboxCopy.notOpen,
  inboxCopy.useDraft,
  "Choose reply or dismiss.",
  inboxCopy.badTier,
] as const;

for (const sentence of INBOX_SENTENCES) {
  test(`inbox resolve keeps ${sentence}`, async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: sentence } }),
    } as unknown as CleatClient;
    await assert.rejects(
      () => resolveInboxItem(client, { itemId: "item-1", action: "reply", body: "On my way" }),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, sentence);
        assert.equal(userFacingError(err.message, copy.generic), sentence);
        assert.equal(userFacingError(err.message, aiCopy.loadFailed), sentence);
        assert.notEqual(err.message, inboxCopy.replySent);
        assert.notEqual(err.message, inboxCopy.dismissed);
        return true;
      },
    );
  });
}

test("inbox resolve does not report success as an error", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "permission denied for table inbox_items" } }),
  } as unknown as CleatClient;
  for (const action of ["reply", "dismiss"] as const) {
    await assert.rejects(
      () => resolveInboxItem(client, { itemId: "item-1", action }),
      (err: unknown) => {
        assert.ok(err instanceof CleatRequestError);
        assert.equal(err.message, copy.generic);
        assert.notEqual(err.message, inboxCopy.replySent);
        assert.notEqual(err.message, inboxCopy.dismissed);
        assert.equal(err.message.includes("permission denied"), false);
        return true;
      },
    );
  }
});
