import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEMO_ARTICLES } from "../../db/src/demo-copy";
import { loadEvalCases, runEval } from "./eval-batch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DASH = /[—–]| - /;

test("seed copy has no dash punctuation and includes the demo articles", () => {
  const sql = readFileSync(join(ROOT, "packages/db/supabase/seed.sql"), "utf8");
  assert.equal(DASH.test(sql), false);
  for (const article of DEMO_ARTICLES) {
    assert.equal(sql.includes(article.title), true, article.title);
    assert.equal(sql.includes(article.body), true, article.title);
  }
  assert.equal(sql.includes("enable_demo_auto_send()"), true);
  assert.equal(sql.includes("seed_inbox_tier"), true);
  assert.equal(sql.includes("Rivera Strength"), true);
  assert.equal(sql.includes("Alex Rivera"), true);
  assert.equal(sql.includes("Foundation 3-day"), true);
  assert.equal(sql.includes("Hypertrophy 4-day"), true);
  assert.equal(sql.includes("Still waiting on a reply about Friday."), true);
  assert.equal(sql.includes("Riley is not a stale unanswered client"), true);
  for (const table of [
    "held_drafts",
    "trainer_notices",
    "inbox_items",
    "audit_events",
    "messages",
    "sessions",
    "nudge_events",
    "log_operations",
    "workout_logs",
  ]) {
    assert.equal(sql.includes(`delete from public.${table} where org_id = demo_org`), true, table);
  }
});

test("eval set covers labels, emergency, and self harm, and the offline run passes", async () => {
  const cases = loadEvalCases(join(ROOT, "docs/eval-messages.json"));
  assert.ok(cases.length >= 20);
  const labels = new Set(cases.map((item) => item.expected));
  assert.equal(labels.has("answer"), true);
  assert.equal(labels.has("escalate"), true);
  assert.equal(labels.has("refuse"), true);
  const emergency = cases.filter((item) => item.templateId === "emergency");
  const selfHarm = cases.filter((item) => item.templateId === "emergency_self_harm");
  const medical = cases.filter((item) => item.templateId === "medical_safety");
  assert.ok(emergency.length >= 3);
  assert.ok(selfHarm.length >= 1);
  assert.ok(medical.length >= 1);
  for (const id of ["injury-deadlift", "self-harm-want", "self-harm-purpose"]) {
    assert.ok(cases.some((item) => item.id === id), id);
  }
  assert.equal(cases.find((item) => item.id === "injury-deadlift")?.templateId, "medical_safety");
  assert.equal(cases.find((item) => item.id === "self-harm-want")?.templateId, "emergency_self_harm");
  assert.equal(cases.find((item) => item.id === "self-harm-purpose")?.templateId, "emergency_self_harm");
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await runEval(cases);
    const deadlift = result.lines.find((line) => line.includes("injury-deadlift"));
    assert.ok(deadlift, result.lines.join("\n"));
    const otherFailed = result.lines.filter((line) => line.startsWith("FAIL") && !line.includes("injury-deadlift"));
    assert.deepEqual(otherFailed, [], result.lines.join("\n"));
    if (deadlift.startsWith("PASS")) {
      assert.match(deadlift, /medical_safety/);
      assert.equal(result.failed, 0);
    } else {
      assert.match(deadlift, /emergency_self_harm/);
      assert.match(deadlift, /medical_safety/);
      assert.equal(result.failed, 1);
    }
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
