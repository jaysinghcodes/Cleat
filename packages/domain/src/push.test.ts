import assert from "node:assert/strict";
import { test } from "node:test";
import { deferredPushDelivery } from "./push";

test("push delivery is deferred and does not send", async () => {
  const status = await deferredPushDelivery.sendNudge({
    clientId: "22222222-2222-2222-2222-222222222222",
    title: "Cleat",
    body: "Alex sent a nudge. Open Today and catch up on a missed day.",
  });
  assert.equal(status, "deferred");
});
