import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldHoldDynamicDeskNav } from "./nav-offline";

test("offline inbox and org clicks stay on the desk", () => {
  assert.equal(shouldHoldDynamicDeskNav("/inbox", false, false), true);
  assert.equal(shouldHoldDynamicDeskNav("/org", false, false), true);
  assert.equal(shouldHoldDynamicDeskNav("/inbox", true, true), true);
  assert.equal(shouldHoldDynamicDeskNav("/org", true, true), true);
  assert.equal(shouldHoldDynamicDeskNav("/inbox", true, false), false);
  assert.equal(shouldHoldDynamicDeskNav("/org", true, false), false);
  assert.equal(shouldHoldDynamicDeskNav("/accountability", false, true), false);
  assert.equal(shouldHoldDynamicDeskNav("/clients", false, false), false);
  assert.equal(shouldHoldDynamicDeskNav("/calendar", true, true), false);
});
