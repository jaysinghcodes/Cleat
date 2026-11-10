import assert from "node:assert/strict";
import test from "node:test";
import { repeatsLearnedQuestion, scoreRetrieval } from "./confidence";
import { chunkArticle } from "./chunk";
import { loadExpandedEvalCases, loadLearnedEval, runEval } from "./eval-batch";
import { keywordScorer } from "./keywords";
import { learnedNoteFromEdit, needsContext } from "./learned";
import { learnedQuestion } from "./learned-format";

const HELD = "I do not have that in your coach's notes yet.";

function note(question: string, editedText: string): string {
  const built = learnedNoteFromEdit({ question, draftText: HELD, editedText });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error("no note");
  return chunkArticle(built.note.title, built.note.body)[0] ?? "";
}

test("a coach edit becomes one faq note that keeps the question next to the answer", () => {
  const built = learnedNoteFromEdit({
    question: "  do you have\nshowers ",
    draftText: HELD,
    editedText: "Yes. Two showers by the locker room.",
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.note.category, "faq");
  assert.equal(built.note.title, "Coach answer: do you have showers");
  assert.match(built.note.body, /^A client asked: do you have showers\n\nCoach answer: Yes\. Two showers/);
  const chunks = chunkArticle(built.note.title, built.note.body);
  assert.equal(chunks.length, 1);
  assert.equal(learnedQuestion(chunks[0] ?? ""), "do you have showers");
});

test("long questions are clipped to the title limit the database enforces", () => {
  const built = learnedNoteFromEdit({ question: "word ".repeat(200), draftText: HELD, editedText: "Answer." });
  assert.equal(built.ok, true);
  if (built.ok) assert.ok(built.note.title.length <= 120 && built.note.body.length <= 8000);
});

test("nothing is learned from an unchanged draft, an empty edit, a safety message, or a message that needs context", () => {
  const skip = (question: string, draftText: string, editedText: string) => {
    const built = learnedNoteFromEdit({ question, draftText, editedText });
    return built.ok ? "saved" : built.reason;
  };
  assert.equal(skip("do you have showers", "Yes we do.", " Yes  we do. "), "unchanged");
  assert.equal(skip("do you have showers", HELD, "   "), "empty");
  assert.equal(skip("my knee hurts on lunges, what should I do", HELD, "Rest it and see a physio."), "safety");
  assert.equal(skip("i want to k1ll myself", HELD, "Call me."), "safety");
  assert.equal(skip("is that ok?", HELD, "Yes that is fine."), "needs_context");
  assert.equal(skip("thanks!", HELD, "Any time."), "needs_context");
  assert.equal(skip("help", HELD, "What do you need?"), "needs_context");
  assert.equal(needsContext("Can I bring a friend to my session?"), false);
});

test("a learned note counts in full only for the question it answered", () => {
  const friend = note("Can I bring a friend to my session?", "Yes, once a month you can bring a friend for free.");
  const bring = "What to bring\nBring a water bottle, a small towel, and flat shoes to each session.";
  const same = keywordScorer("can I bring a friend to my session", [friend, bring]);
  assert.equal(same.score(friend).coverage, 1);
  const other = keywordScorer("what should I bring to my session", [friend, bring]);
  assert.ok(other.score(friend).coverage < 0.6);
  assert.equal(other.score(bring).coverage, 1);
});

test("an exact repeat of a learned question is not treated as a thin question", () => {
  const showers = note("do you have showers", "Yes. Two showers by the locker room.");
  assert.equal(repeatsLearnedQuestion("Do you have showers?", showers), true);
  assert.equal(repeatsLearnedQuestion("do you have towels", showers), false);
  assert.equal(repeatsLearnedQuestion("do you have showers", "Gym hours\nThe showers close at 9 pm."), false);
  const repeat = scoreRetrieval("do you have showers", [{ snippet: showers, score: 0.88 }]);
  assert.ok(repeat.confidence >= 0.85);
  const plain = scoreRetrieval("do you have showers", [{ snippet: "Gym hours\nThe showers close at 9 pm.", score: 0.88 }]);
  assert.ok(plain.confidence <= 0.55);
});

test("learned eval fails before the coach edits and passes after, with no wrong auto sends", async () => {
  const learned = loadLearnedEval();
  const before = await runEval(learned.cases, { corpus: "extended" });
  const after = await runEval(learned.cases, { corpus: "extended", extraArticles: learned.notes });
  const fixed = learned.cases.filter((item) => item.id.endsWith("-same"));
  assert.equal(fixed.length, learned.edits.length);
  for (const item of fixed) {
    assert.ok(before.failures.some((line) => line.includes(item.id)), `${item.id} should fail before`);
    assert.equal(after.failures.some((line) => line.includes(item.id)), false, `${item.id} should pass after`);
  }
  assert.equal(after.metrics.wrongAutoSends, 0);
  assert.equal(after.metrics.safetyPassed, after.metrics.safetyChecks);
  assert.ok(after.metrics.passed > before.metrics.passed);
});

test("learned notes do not cause wrong auto sends on the rest of the expanded set", async () => {
  const learned = loadLearnedEval();
  const answered = new Set(learned.edits.map((edit) => edit.question));
  const others = loadExpandedEvalCases().filter((item) => !answered.has(item.message));
  const run = await runEval(others, { corpus: "extended", extraArticles: learned.notes });
  assert.equal(run.metrics.wrongAutoSends, 0);
  assert.equal(run.metrics.safetyPassed, run.metrics.safetyChecks);
});
