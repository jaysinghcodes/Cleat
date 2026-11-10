import assert from "node:assert/strict";
import { test } from "node:test";
import { hasKeyword, indexKeywords, keywordScorer, keywordTokens, oneEditApart, stem } from "./keywords";
import { blendKeywordRank, type RetrievedChunk } from "./retrieve";

function row(id: string, snippet: string, score: number): RetrievedChunk {
  return {
    id,
    orgId: "00000000-0000-4000-8000-000000000002",
    clientId: null,
    snippet,
    score,
    articleId: id,
    source: "kb",
    title: null,
  };
}

test("keyword tokens drop filler and stem endings", () => {
  assert.deepEqual(keywordTokens("How do I log my workouts?"), ["log", "workout"]);
  assert.deepEqual(keywordTokens("what's the warmup routine"), ["warmup", "routine"]);
  assert.deepEqual(keywordTokens("is that ok?"), []);
  assert.equal(stem("logging"), "log");
  assert.equal(stem("missed"), "miss");
  assert.equal(stem("press"), "press");
  assert.equal(stem("12"), "12");
});

test("one edit apart covers a swap, a drop, an extra letter, and a wrong letter", () => {
  assert.equal(oneEditApart("workuot", "workout"), true);
  assert.equal(oneEditApart("betwen", "between"), true);
  assert.equal(oneEditApart("programm", "program"), true);
  assert.equal(oneEditApart("squat", "squit"), true);
  assert.equal(oneEditApart("squat", "bench"), false);
  assert.equal(oneEditApart("cancel", "candle"), false);
});

test("a typo matches only on longer words that share a first letter", () => {
  const index = indexKeywords("Rest 2 to 3 minutes between sets. Start with a warm up.");
  assert.equal(hasKeyword(index, "betwen"), true);
  assert.equal(hasKeyword(index, "warmup"), true);
  assert.equal(hasKeyword(index, "rust"), false);
  assert.equal(hasKeyword(index, "retween"), false);
});

test("a word the notes never mention pulls coverage down", () => {
  const pool = [
    "How to book or cancel\nOpen the Book tab, pick an open slot, and cancel from that session.",
    "Gym hours\nThe gym is open 6 am to 9 pm on weekdays.",
  ];
  const known = keywordScorer("how do I cancel a session", pool);
  assert.deepEqual(known.unknown, []);
  assert.equal(known.score(pool[0] ?? "").coverage, 1);
  const gap = keywordScorer("how do I cancel my membership", pool);
  assert.deepEqual(gap.unknown, ["membership"]);
  assert.ok(gap.score(pool[0] ?? "").coverage < 0.5);
});

test("hybrid rank lifts the snippet that covers the question over a closer vector", () => {
  const rows = [
    row("a", "Equipment is taken\nIf the squat rack is taken, do goblet squats.", 0.4),
    row("b", "Gym hours\nThe gym is open 6 am to 9 pm on weekdays.", 0.3),
  ];
  const ranked = blendKeywordRank("what time does the gym open on weekdays", rows);
  assert.equal(ranked[0]?.id, "b");
  assert.equal(ranked[0]?.vectorScore, 0.3);
  assert.ok((ranked[0]?.coverage ?? 0) > (ranked[1]?.coverage ?? 0));
});

test("a question with no content words keeps the vector order", () => {
  const rows = [row("a", "Gym hours\nOpen late.", 0.2), row("b", "Deload\nLighter weights.", 0.5)];
  const ranked = blendKeywordRank("is that ok?", rows);
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["b", "a"],
  );
  assert.equal(ranked[0]?.score, 0.5);
});
