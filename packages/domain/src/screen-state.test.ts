import assert from "node:assert/strict";
import { test } from "node:test";
import { chatCopy } from "./message";
import { programCopy } from "./program";
import { copy } from "./auth";
import { bookingCopy } from "./calendar";
import {
  connectionMessage,
  offlineActionReason,
  screenCopy,
  userFacingError,
} from "./screen-state";

test("screen copy has no dash punctuation", () => {
  for (const value of Object.values(screenCopy)) {
    assert.equal(value.includes("\u2014"), false, value);
    assert.equal(value.includes("\u2013"), false, value);
    assert.equal(value.includes(" - "), false, value);
  }
});

test("chat send, booking, and program load failures stay friendly", () => {
  const chatRaw = "TypeError: fetch failed\n    at sendChatMessage (messages.ts:140:11)";
  assert.equal(userFacingError(chatRaw, chatCopy.sendFailed), chatCopy.sendFailed);
  assert.equal(userFacingError(new Error(chatRaw), chatCopy.sendFailed).includes("messages.ts"), false);

  const bookingRaw = 'duplicate key value violates unique constraint "sessions_pkey"';
  assert.equal(userFacingError(bookingRaw, copy.generic), copy.generic);
  assert.equal(userFacingError(bookingCopy.slotTaken, copy.generic), bookingCopy.slotTaken);

  const programRaw = "JWT expired: PGRST301";
  assert.equal(userFacingError(programRaw, programCopy.couldNotLog), programCopy.couldNotLog);
  assert.equal(userFacingError(programRaw, screenCopy.loadFailed), screenCopy.loadFailed);
});

test("a known product sentence is not replaced", () => {
  assert.equal(userFacingError(copy.emptyBody, copy.generic), copy.emptyBody);
  assert.equal(userFacingError(`prefix ${copy.emptyBody} suffix`, copy.generic), copy.emptyBody);
});

test("connection banner and offline actions", () => {
  assert.equal(connectionMessage(true, 0), null);
  assert.equal(connectionMessage(false, 0), screenCopy.offline);
  assert.equal(connectionMessage(false, 2), programCopy.savedOffline);
  assert.equal(connectionMessage(true, 1), programCopy.savedOffline);
  assert.equal(offlineActionReason(true), null);
  assert.equal(offlineActionReason(false), screenCopy.offlineAction);
});
