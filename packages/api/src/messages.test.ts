import assert from "node:assert/strict";
import { test } from "node:test";
import type { CleatClient } from "./supabase";
import { deliverChatMessage } from "./messages";
import { onClientMessage, setClientMessageHook, type ClientMessageEvent } from "./message-hook";
import { noopPushNotifier, type PushNotice } from "./push";

const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const TRAINER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MESSAGE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function fake(role: "client" | "trainer", userId: string): CleatClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    rpc: async (name: string, args?: Record<string, string>) => {
      if (name === "current_membership") {
        return {
          data: [
            {
              org_id: ORG_ID,
              org_name: "Rivera Strength",
              role,
              display_name: role === "client" ? "Sam Lee" : "Alex Rivera",
              timezone: "America/Chicago",
            },
          ],
          error: null,
        };
      }
      if (name === "post_message") {
        return {
          data: [
            {
              message_id: MESSAGE_ID,
              message_thread_id: THREAD_ID,
              message_org_id: ORG_ID,
              message_sender_id: userId,
              posted_body: args?.message_body,
              message_created_at: "2026-10-07T12:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: { message: "missing rpc" } };
    },
  } as unknown as CleatClient;
}

test("default client message hook sends nothing", async () => {
  const event: ClientMessageEvent = {
    id: MESSAGE_ID,
    threadId: THREAD_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    body: "Hello coach",
    createdAt: "2026-10-07T12:00:00.000Z",
  };
  const result = await onClientMessage(event);
  assert.equal(result, undefined);
});

test("a client message calls the hook once and does not notify", async () => {
  const seen: ClientMessageEvent[] = [];
  const notices: PushNotice[] = [];
  const message = await deliverChatMessage(
    fake("client", CLIENT_ID),
    { body: "  Hello coach  ", clientId: TRAINER_ID },
    {
      hook: async (event) => {
        seen.push(event);
      },
      notifier: {
        notify: async (notice) => {
          notices.push(notice);
        },
      },
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.clientId, CLIENT_ID);
  assert.equal(seen[0]?.body, "Hello coach");
  assert.equal(notices.length, 0);
  assert.equal(message.body, "Hello coach");
  assert.equal(message.senderId, CLIENT_ID);
  assert.equal("reply" in message, false);
});

test("deliver uses the default hook once when none is injected", async () => {
  let calls = 0;
  setClientMessageHook(async () => {
    calls += 1;
  });
  try {
    await deliverChatMessage(fake("client", CLIENT_ID), { body: "Hello coach" });
    assert.equal(calls, 1);
  } finally {
    setClientMessageHook(async () => undefined);
  }
});

test("a trainer message notifies once and does not call the hook", async () => {
  let hooks = 0;
  const notices: PushNotice[] = [];
  const message = await deliverChatMessage(
    fake("trainer", TRAINER_ID),
    { body: "Keep the torso tall", clientId: CLIENT_ID },
    {
      hook: async () => {
        hooks += 1;
      },
      notifier: {
        notify: async (notice) => {
          notices.push(notice);
        },
      },
    },
  );
  assert.equal(hooks, 0);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.userId, CLIENT_ID);
  assert.equal(notices[0]?.data.screen, "chat");
  assert.equal(notices[0]?.title, "New message");
  assert.equal(message.senderId, TRAINER_ID);
});

test("the default notifier does not call fetch", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    return Promise.resolve(new Response());
  };
  try {
    await noopPushNotifier.notify({
      userId: CLIENT_ID,
      title: "New message",
      body: "Keep the torso tall",
      data: { screen: "chat", threadId: THREAD_ID },
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("a failing hook still returns the stored message", async () => {
  const message = await deliverChatMessage(
    fake("client", CLIENT_ID),
    { body: "Hello coach" },
    {
      hook: async () => {
        throw new Error("ai down");
      },
    },
  );
  assert.equal(message.body, "Hello coach");
});
