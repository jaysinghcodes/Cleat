import assert from "node:assert/strict";
import { test } from "node:test";
import { formatWeight, isOfflineError, parseWeight, weightToKg } from "./log";

test("135 lb stores in kg, shows as 61.2 kg, and comes back as 135 lb", () => {
  const kg = weightToKg(135, "lb");
  assert.equal(kg, 61.235);
  assert.equal(formatWeight(kg, "kg"), "61.2");
  assert.equal(formatWeight(kg, "lb"), "135");
});

test("a kilogram entry stays in kilograms", () => {
  const kg = weightToKg(60, "kg");
  assert.equal(kg, 60);
  assert.equal(formatWeight(kg, "kg"), "60");
  assert.equal(formatWeight(kg, "lb"), "132.3");
});

test("parseWeight rejects empty and negative values", () => {
  assert.equal(parseWeight(""), null);
  assert.equal(parseWeight("nope"), null);
  assert.equal(parseWeight("-1"), null);
  assert.equal(parseWeight("20.5"), 20.5);
});

test("offline errors are recognized", () => {
  assert.equal(isOfflineError(new TypeError("Failed to fetch")), true);
  assert.equal(isOfflineError(new Error("Enter reps for at least one set.")), false);
});
