import assert from "node:assert/strict";
import { test } from "node:test";
import { commitHeldDraft } from "./server/draft-commit";

test("send as is posts one chat message when the draft is claimed twice", async () => {
  let held = true;
  let posts = 0;
  const run = () =>
    commitHeldDraft({
      loaded: { draftText: "Rest two days." },
      action: "send_as_is",
      claim: async () => {
        if (!held) return false;
        held = false;
        return true;
      },
      writeAudit: async () => undefined,
      postChat: async () => {
        posts += 1;
      },
      closeInbox: async () => undefined,
    });
  const [first, second] = await Promise.all([run(), run()]);
  assert.equal(posts, 1);
  assert.equal(first.posted || second.posted, true);
  assert.equal(first.posted && second.posted, false);
  assert.equal(first.httpStatus, 200);
  assert.equal(second.httpStatus, 200);
});

function noteHarness(action: "send_edited" | "send_as_is" | "dismiss", save: () => Promise<boolean>) {
  const calls: string[] = [];
  const run = commitHeldDraft({
    loaded: { draftText: "I do not have that in your coach's notes yet." },
    action,
    editedText: "Yes. Two showers by the locker room.",
    claim: async () => true,
    writeAudit: async () => {
      calls.push("audit");
    },
    postChat: async () => {
      calls.push("chat");
    },
    closeInbox: async () => {
      calls.push("inbox");
    },
    saveNote: async (edit) => {
      calls.push(`note:${edit.editedText}`);
      return save();
    },
  });
  return { calls, run };
}

test("an edited reply saves the note after the reply is posted", async () => {
  const { calls, run } = noteHarness("send_edited", async () => true);
  const result = await run;
  assert.deepEqual(calls, ["audit", "chat", "inbox", "note:Yes. Two showers by the locker room."]);
  assert.equal(result.httpStatus, 200);
  if (result.httpStatus === 200) assert.equal(result.body.noteSaved, true);
});

test("approve and reject never save a note", async () => {
  for (const action of ["send_as_is", "dismiss"] as const) {
    const { calls, run } = noteHarness(action, async () => true);
    const result = await run;
    assert.equal(calls.some((call) => call.startsWith("note:")), false);
    if (result.httpStatus === 200) assert.equal(result.body.noteSaved, false);
  }
});

test("a failed note save does not undo the reply", async () => {
  const { calls, run } = noteHarness("send_edited", async () => {
    throw new Error("embed failed");
  });
  const result = await run;
  assert.equal(result.httpStatus, 200);
  assert.equal(result.posted, true);
  assert.ok(calls.includes("chat"));
  if (result.httpStatus === 200) assert.equal(result.body.noteSaved, false);
});

test("a second send of the same draft saves no note", async () => {
  let notes = 0;
  const result = await commitHeldDraft({
    loaded: { draftText: "Draft." },
    action: "send_edited",
    editedText: "Edited.",
    claim: async () => false,
    writeAudit: async () => undefined,
    postChat: async () => undefined,
    closeInbox: async () => undefined,
    saveNote: async () => {
      notes += 1;
      return true;
    },
  });
  assert.equal(notes, 0);
  assert.equal(result.posted, false);
});
