import assert from "node:assert/strict";
import { test } from "node:test";
import { planClientTurn, type ChatModel } from "@cleat/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { commitPlan } from "./server/pipeline";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const TRAINER = "11111111-1111-4111-8111-111111111111";
const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MESSAGE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUDIT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const INBOX = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const chat: ChatModel = {
  model: "test",
  async complete() {
    return { text: "Rest two days.", confidence: 0.4 };
  },
};

function admin(inserts: { table: string; row: Record<string, unknown> }[]): SupabaseClient {
  return {
    from(table: string) {
      const api = {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return api;
        },
        select() {
          return api;
        },
        eq() {
          return api;
        },
        limit() {
          return api;
        },
        maybeSingle: async () => ({ data: { user_id: TRAINER }, error: null }),
        single: async () => ({
          data: { id: table === "audit_events" ? AUDIT : INBOX },
          error: null,
        }),
        then(resolve: (value: { error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return api;
    },
  } as unknown as SupabaseClient;
}

test("commitPlan stores the client message and the safety template on the inbox item", async () => {
  const body = `Chest pain during the warmup. ${"tight ".repeat(120)}`;
  const plan = await planClientTurn({
    message: body,
    messageId: MESSAGE,
    orgId: ORG,
    clientId: CLIENT,
    threadId: THREAD,
    chunks: [],
    settings: { autoSend: false, threshold: 0.85, signOff: "", toneNotes: "" },
    chat,
    now: "2026-10-09T12:00:00.000Z",
  });
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  await commitPlan(
    admin(inserts),
    {
      id: MESSAGE,
      threadId: THREAD,
      orgId: ORG,
      clientId: CLIENT,
      body: `  ${body}  `,
      createdAt: "2026-10-09T12:00:00.000Z",
    },
    plan,
  );
  const inbox = inserts.find((item) => item.table === "inbox_items");
  assert.ok(inbox);
  assert.equal(inbox.row.preview, body.trim().slice(0, 500));
  assert.equal(String(inbox.row.preview).length, 500);
  assert.equal(inbox.row.template_id, "emergency");
  assert.equal(inbox.row.message_id, MESSAGE);
  assert.equal(inbox.row.priority, "p0");
});
