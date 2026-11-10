import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIDENCE_WEIGHTS,
  DEFAULT_THRESHOLD,
  MIN_THRESHOLD,
  NO_CONTENT_CEILING,
  THIN_QUESTION_CEILING,
  isThinQuestion,
  scoreRetrieval,
} from "./confidence";

const HOURS = "Gym hours\nThe gym is open 6 am to 9 pm on weekdays and 8 am to 2 pm on Saturday and Sunday.";
const PACKS = "Session packs\nSessions are sold in packs of 5 or 10. A pack expires 90 days after you buy it.";
const DELOAD = "How does a deload week work\nKeep the same exercises and use lighter weights.";

function chunks(...items: [string, number][]) {
  return items.map(([snippet, score]) => ({ snippet, score }));
}

test("the weights add up to one and coverage carries most of the score", () => {
  assert.equal(CONFIDENCE_WEIGHTS.strength + CONFIDENCE_WEIGHTS.coverage, 1);
  assert.ok(CONFIDENCE_WEIGHTS.coverage > CONFIDENCE_WEIGHTS.strength);
});

test("a question fully covered by the best note clears the default cutoff", () => {
  const result = scoreRetrieval("What time does the gym open on weekdays?", chunks([HOURS, 0.5], [PACKS, 0.1]));
  assert.ok(result.confidence >= DEFAULT_THRESHOLD, String(result.confidence));
  assert.deepEqual(result.reasonCodes, []);
});

test("a word no note contains keeps the score under the cutoff", () => {
  const result = scoreRetrieval("How much does a pack of 10 sessions cost?", chunks([PACKS, 0.5], [HOURS, 0.1]));
  assert.ok(result.confidence < DEFAULT_THRESHOLD, String(result.confidence));
  assert.equal(result.reasonCodes.length, 1);
});

test("coverage is read from the best note, not from every note together", () => {
  const spread = scoreRetrieval("When does my session pack expire on weekdays?", chunks([HOURS, 0.6], [PACKS, 0.5]));
  assert.ok(spread.confidence < DEFAULT_THRESHOLD, String(spread.confidence));
});

test("a question with no content words is capped low", () => {
  const result = scoreRetrieval("is that ok?", chunks([HOURS, 0.9]));
  assert.ok(result.confidence <= NO_CONTENT_CEILING);
  assert.deepEqual(result.reasonCodes, ["ambiguous"]);
});

test("a thin question is held at every threshold a coach can set", () => {
  assert.ok(THIN_QUESTION_CEILING < MIN_THRESHOLD);
  assert.equal(isThinQuestion("how does it work", 1), true);
  assert.equal(isThinQuestion("is that ok for squats", 2), true);
  assert.equal(isThinQuestion("how do I log my workout", 2), false);
  const vague = scoreRetrieval("how does it work", chunks([DELOAD, 0.5]));
  assert.ok(vague.confidence <= THIN_QUESTION_CEILING, String(vague.confidence));
  assert.equal(vague.reasonCodes.includes("ambiguous"), true);
});

test("a thin question still passes when the note is a near copy of it", () => {
  const result = scoreRetrieval("deload", chunks(["deload", 1]));
  assert.ok(result.confidence >= DEFAULT_THRESHOLD);
});

test("coverage passed in by hybrid search is used as given", () => {
  const result = scoreRetrieval("gym open weekdays", [{ snippet: HOURS, score: 0.5, coverage: 0.4 }]);
  assert.equal(result.confidence, 0.41);
  assert.deepEqual(result.reasonCodes, ["ambiguous"]);
});

test("no notes at all is a retrieval gap", () => {
  assert.deepEqual(scoreRetrieval("anything", []), { confidence: 0.2, reasonCodes: ["retrieval_gap"] });
});
