import assert from "node:assert/strict";
import { test } from "node:test";
import type { InboxQueueItem } from "./inbox";
import { reviewBanner, reviewCopy, reviewCountLabel, reviewEditChanged, reviewQueue } from "./review";

const DASH = /[—–]| - /;

function item(patch: Partial<InboxQueueItem>): InboxQueueItem {
  return {
    id: "a",
    orgId: "o",
    clientId: "c",
    clientName: "Sam",
    priority: "p1",
    emergency: false,
    reason: "ai_escalate",
    reasonCodes: ["low_confidence"],
    title: "Draft held",
    preview: "do you have showers",
    createdAt: "2026-11-01T10:00:00.000Z",
    auditId: null,
    messageId: null,
    templateId: null,
    confidence: 0.4,
    threshold: 0.85,
    draft: { id: "d", text: "Draft", sources: [] },
    why: [],
    derived: false,
    nudgeKind: null,
    ...patch,
  };
}

test("review queue keeps only held answers, oldest first", () => {
  const queue = reviewQueue([
    item({ id: "new", createdAt: "2026-11-02T10:00:00.000Z" }),
    item({ id: "old", createdAt: "2026-11-01T09:00:00.000Z" }),
    item({ id: "refusal", priority: "p0", draft: null, templateId: "medical_safety" }),
    item({ id: "unanswered", priority: "p2", draft: null }),
    item({ id: "missed", priority: "p3", draft: null }),
    item({ id: "no-draft", draft: null }),
  ]);
  assert.deepEqual(
    queue.map((row) => row.id),
    ["old", "new"],
  );
});

test("a safety template never shows in review, even with a draft attached", () => {
  assert.equal(reviewQueue([item({ templateId: "emergency" })]).length, 0);
});

test("an edit counts only when the words change", () => {
  assert.equal(reviewEditChanged("Yes, two showers.", "Yes,  two showers.\n"), false);
  assert.equal(reviewEditChanged("Yes, two showers.", "Yes, two showers by the lockers."), true);
});

test("banner tells the coach what happened to the note", () => {
  assert.equal(reviewBanner({ action: "approve", noteAsked: false, noteSaved: false }), reviewCopy.approved);
  assert.equal(reviewBanner({ action: "reject", noteAsked: false, noteSaved: false }), reviewCopy.rejected);
  assert.equal(reviewBanner({ action: "edit", noteAsked: false, noteSaved: false }), reviewCopy.editSent);
  assert.equal(reviewBanner({ action: "edit", noteAsked: true, noteSaved: true }), reviewCopy.editSentNoted);
  assert.equal(reviewBanner({ action: "edit", noteAsked: true, noteSaved: false }), reviewCopy.editSentNoteFailed);
  assert.equal(reviewCountLabel(3), "3 waiting");
});

test("review copy has no dash punctuation and never calls the score a probability it is", () => {
  for (const value of Object.values(reviewCopy)) {
    assert.equal(DASH.test(value), false, value);
    assert.equal(/-/.test(value), false, value);
    assert.equal(/calibrated/i.test(value), false, value);
  }
  assert.match(reviewCopy.scoreHelp, /not a probability/);
});
