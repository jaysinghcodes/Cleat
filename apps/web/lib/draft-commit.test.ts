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
