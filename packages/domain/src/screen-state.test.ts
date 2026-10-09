import assert from "node:assert/strict";
import { test } from "node:test";
import { chatCopy } from "./message";
import { programCopy } from "./program";
import { copy } from "./auth";
import { bookingCopy } from "./calendar";
import { inboxCopy } from "./inbox";
import {
  clientSessionView,
  connectionMessage,
  deskSessionView,
  offlineActionReason,
  screenCopy,
  screenPreviewFromSearch,
  sessionLoadError,
  trainingRetryResult,
  trainingRetryStart,
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

const RAW_ERRORS = [
  "permission denied for table inbox_items",
  "Could not find the function public.book_slot(p_slot) in the schema cache",
  "column clients.foo does not exist",
  "JSON object requested, multiple (or no) rows returned",
  "AuthApiError: Invalid Refresh Token: Refresh Token Not Found",
  "canceling statement due to statement timeout",
  "insufficient_privilege",
  "Load failed",
  "TypeError: Failed to fetch",
] as const;

for (const raw of RAW_ERRORS) {
  test(`userFacingError hides ${raw}`, () => {
    assert.equal(userFacingError(raw, screenCopy.loadFailed), screenCopy.loadFailed);
    assert.equal(userFacingError(new Error(raw), copy.generic), copy.generic);
    assert.equal(userFacingError(raw, chatCopy.sendFailed), chatCopy.sendFailed);
    assert.equal(userFacingError(raw, programCopy.couldNotLog), programCopy.couldNotLog);
    assert.equal(userFacingError(raw, screenCopy.loadFailed).includes(raw), false);
  });
}

test("screen preview is an allowlisted dev query", () => {
  assert.equal(screenPreviewFromSearch(""), null);
  assert.equal(screenPreviewFromSearch("?preview=1&state=error"), "error");
  assert.equal(screenPreviewFromSearch("preview=1&state=offline"), "offline");
  assert.equal(screenPreviewFromSearch("?preview=1&state=loading"), "loading");
  assert.equal(screenPreviewFromSearch("?preview=1"), "empty");
  assert.equal(screenPreviewFromSearch("?preview=1&state=nope"), "empty");
  assert.equal(screenPreviewFromSearch("?state=error"), null);
  assert.equal(screenPreviewFromSearch("?preview=1&state=error", "production"), null);
});

const KEPT_SENTENCES = [
  "Calendar signing is not configured.",
  "Google Calendar is not configured.",
  "Only a coach can connect Google Calendar.",
  "Google did not return a calendar connection.",
  inboxCopy.signIn,
  inboxCopy.notOpen,
  inboxCopy.useDraft,
  "Choose reply or dismiss.",
  inboxCopy.badTier,
] as const;

for (const sentence of KEPT_SENTENCES) {
  test(`userFacingError keeps ${sentence}`, () => {
    assert.equal(userFacingError(sentence, copy.generic), sentence);
    assert.equal(userFacingError(`db says: ${sentence}`, screenCopy.loadFailed), sentence);
  });
}

test("a membership load failure shows the error state, not Checking your session", () => {
  const loadError = sessionLoadError(new Error("permission denied for table inbox_items"));
  assert.equal(loadError, screenCopy.loadFailed);
  assert.equal(loadError.includes("permission denied"), false);
  assert.equal(sessionLoadError(new Error(copy.generic)), screenCopy.loadFailed);
  const view = deskSessionView({
    ready: true,
    configured: true,
    hasSession: true,
    role: null,
    loadError,
  });
  assert.equal(view, "error");
  assert.notEqual(view, "checking");
  assert.notEqual(view, "signup");
  assert.notEqual(view, "login");
  assert.equal(
    deskSessionView({ ready: false, configured: true, hasSession: true, role: "trainer", loadError: null }),
    "checking",
  );
});

test("a load sentence is not shortened to its title", () => {
  assert.equal(userFacingError(screenCopy.loadFailed, copy.generic), screenCopy.loadFailed);
  assert.equal(userFacingError(new Error(screenCopy.loadFailed), programCopy.couldNotLog), screenCopy.loadFailed);
});

test("a successful retry clears the load error", () => {
  const started = trainingRetryStart();
  assert.equal(started.ready, false);
  assert.equal(started.error, null);
  const done = trainingRetryResult(null);
  assert.equal(done.ready, true);
  assert.equal(done.error, null);
});

test("a failed retry shows the load sentence again", () => {
  const done = trainingRetryResult(new Error("permission denied for table inbox_items"));
  assert.equal(done.ready, true);
  assert.equal(done.error, screenCopy.loadFailed);
  assert.notEqual(done.error, programCopy.couldNotLog);
  assert.equal(done.error?.includes("permission denied"), false);
});

test("a coach load failure shows the error state, not the login redirect", () => {
  const view = clientSessionView({
    ready: true,
    configured: true,
    hasSession: true,
    role: "client",
    loadError: screenCopy.loadFailed,
  });
  assert.equal(view, "error");
  assert.equal(
    clientSessionView({ ready: true, configured: true, hasSession: false, role: null, loadError: null }),
    "login",
  );
});

test("connection banner and offline actions", () => {
  assert.equal(connectionMessage(true, 0), null);
  assert.equal(connectionMessage(false, 0), screenCopy.offline);
  assert.equal(connectionMessage(false, 2), programCopy.savedOffline);
  assert.equal(connectionMessage(true, 1), programCopy.savedOffline);
  assert.equal(offlineActionReason(true), null);
  assert.equal(offlineActionReason(false), screenCopy.offlineAction);
});
