import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { aiCopy } from "./ai";
import {
  chatCopy,
  clientAiPresentation,
  coachJumpIn,
  mergeMessages,
  messagePlaceholder,
  messagePreview,
  parsePostedMessage,
  replyPlaceholder,
  splitMessageBody,
  upsertMessage,
  type Message,
} from "./message";

const DASH = /[—–]| - /;

const sample = (id: string, body: string, createdAt: string): Message => ({
  id,
  threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  senderId: "22222222-2222-4222-8222-222222222222",
  body,
  createdAt,
  kind: "human",
  sources: [],
});

test("client AI presentation shows sources and never a confidence number", () => {
  const ai = sample("11111111-1111-4111-8111-111111111111", "Rest two days.", "2026-10-08T12:00:00.000Z");
  ai.kind = "ai";
  ai.sources = [{ title: "Rest days", articleId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }];
  const view = clientAiPresentation(ai, "Alex Rivera");
  assert.equal(view?.label, "AI · auto-sent");
  assert.equal(view?.sources, "Sources: Rest days");
  assert.equal(view?.footer, "Alex can still jump in anytime");
  assert.equal(JSON.stringify(view).includes("confidence"), false);
  assert.equal(view?.footer?.includes("Your trainer will reply"), false);
  const refusal = clientAiPresentation(
    { ...ai, sources: [], body: "This sounds urgent." },
    "Alex Rivera",
  );
  assert.equal(refusal?.label, "AI");
  assert.equal(refusal?.sources, null);
  assert.equal(refusal?.footer, null);
  const approved = sample("33333333-3333-4333-8333-333333333333", "Rest two days.", "2026-10-08T12:00:02.000Z");
  approved.sources = [{ title: "Rest days", articleId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }];
  assert.equal(clientAiPresentation(approved, "Alex Rivera"), null);
  assert.equal(clientAiPresentation(sample("22222222-2222-4222-8222-222222222222", "Hi", "2026-10-08T12:00:01.000Z"), "Alex"), null);
  assert.equal(coachJumpIn(""), "Your coach can still jump in anytime");
  assert.doesNotMatch(chatCopy.aiAutoSent, DASH);
  assert.doesNotMatch(chatCopy.draftHeld, DASH);
  assert.doesNotMatch(chatCopy.draftHeldBody, DASH);
});

test("chat copy has no dash punctuation", () => {
  for (const value of Object.values(chatCopy)) {
    assert.doesNotMatch(value, DASH);
  }
  for (const value of Object.values(aiCopy)) {
    assert.doesNotMatch(value, DASH);
  }
  assert.doesNotMatch(replyPlaceholder("Alex Rivera"), DASH);
  assert.doesNotMatch(messagePlaceholder("Alex Rivera"), DASH);
  assert.equal(replyPlaceholder("Alex Rivera"), "Reply as Alex");
  assert.equal(messagePlaceholder("Alex Rivera"), "Message Alex");
  assert.equal(messagePlaceholder(""), chatCopy.writeMessage);
});

test("links become links and markup stays text", () => {
  const parts = splitMessageBody(
    'See https://example.com/lower-a. Then <script>alert(1)</script> and javascript:alert(1)',
  );
  assert.deepEqual(
    parts.filter((part) => part.kind === "link").map((part) => part.text),
    ["https://example.com/lower-a"],
  );
  const text = parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("");
  assert.match(text, /<script>alert\(1\)<\/script>/);
  assert.match(text, /javascript:alert\(1\)/);
  assert.match(text, /\. Then /);
});

test("message preview keeps a single line", () => {
  assert.equal(messagePreview("Hello\ncoach"), "Hello coach");
  assert.equal(messagePreview("short"), "short");
  assert.equal(messagePreview("x".repeat(90)).length, 80);
});

test("upsert ignores a duplicate and merge keeps time order", () => {
  const first = sample("11111111-1111-4111-8111-111111111111", "one", "2026-10-07T12:00:01.000Z");
  const second = sample("22222222-2222-4222-8222-222222222222", "two", "2026-10-07T12:00:02.000Z");
  assert.equal(upsertMessage([first], first).length, 1);
  assert.deepEqual(
    mergeMessages([second], [first, second]).map((item) => item.body),
    ["one", "two"],
  );
});

test("posted row maps onto a message and does not invent a reply", () => {
  const message = parsePostedMessage([
    {
      message_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      message_thread_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      message_org_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      message_sender_id: "22222222-2222-4222-8222-222222222222",
      posted_body: "Hello coach",
      message_created_at: "2026-10-07T12:00:00.000Z",
    },
  ]);
  assert.ok(message);
  assert.equal(message?.body, "Hello coach");
  assert.equal("reply" in (message ?? {}), false);
});

test("migration stores the same user facing errors", () => {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/db/supabase/migrations/0004_chat.sql",
  );
  const sql = readFileSync(path, "utf8");
  for (const value of [chatCopy.signIn, chatCopy.emptyBody, chatCopy.tooLong, chatCopy.onlyCoach, chatCopy.notOnRoster]) {
    assert.equal(sql.includes(value), true, value);
    assert.doesNotMatch(value, DASH);
  }
  assert.doesNotMatch(sql, /[—–]/);
});
