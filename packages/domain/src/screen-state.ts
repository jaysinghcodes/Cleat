import { aiCopy } from "./ai";
import { copy, productError } from "./auth";
import { bookingCopy } from "./calendar";
import { inboxCopy } from "./inbox";
import { chatCopy } from "./message";
import { programCopy } from "./program";

/** Plain copy for empty, loading, error, and offline treatments. */
export const screenCopy = {
  retry: "Try again",
  offline: "You are offline.",
  offlineAction: "You are offline. Try again when you are back online.",
  couldNotLoad: "Could not load this screen",
  loadFailed: "Could not load this screen. Try again.",
  loadingCleat: "Loading Cleat",
  loadingToday: "Loading today",
  loadingProgram: "Loading your program",
  loadingChat: "Loading messages",
  loadingBook: "Loading sessions",
  loadingMe: "Loading your profile",
  loadingLog: "Loading this exercise",
  loadingBoard: "Loading the board",
  loadingInbox: "Loading the inbox",
  loadingClients: "Loading clients",
  loadingPrograms: "Loading programs",
  loadingKnowledge: "Loading knowledge",
  loadingCalendar: "Loading the calendar",
  loadingSettings: "Loading AI settings",
  loadingAudit: "Loading the audit log",
  loadingOrg: "Loading org settings",
  emptyLogTitle: "No exercise selected",
  emptyLogBody: "Pick an exercise from Today.",
  emptyCalendarTitle: "No hours yet",
  emptyCalendarBody: "Set weekly hours so clients can book.",
  emptySettingsTitle: "Defaults are ready",
  emptySettingsBody: "Auto send stays off until you turn it on.",
  emptyMeTitle: "Profile unavailable",
  emptyMeBody: "Your profile has not loaded. Try again.",
  emptyOrgTitle: "No org yet",
  emptyOrgBody: "Finish sign up, then return here.",
  emptyAuditDetailTitle: "No audit found",
  emptyAuditDetailBody: "That action is not in the log.",
} as const;

/** Product sentences that are not already in knownProductErrors. */
const MORE_PRODUCT_ERRORS = [
  copy.enterEmail,
  copy.enterCode,
  copy.codeFailed,
  copy.emailFailed,
  copy.waitCode,
  copy.noTrainerAccount,
  copy.noClientAccount,
  copy.generic,
  copy.profileSaveFailed,
  copy.inviteCreateFailed,
  copy.deskForCoaches,
  copy.appForClients,
  copy.unconfigured,
  bookingCopy.slotTaken,
  bookingCopy.slotClosed,
  bookingCopy.alreadyThen,
  bookingCopy.alreadyCancelled,
  bookingCopy.notYours,
  bookingCopy.signInBook,
  bookingCopy.clientsOnly,
  bookingCopy.signInSync,
  bookingCopy.linkInvalid,
  bookingCopy.linkReplaced,
  bookingCopy.connectGoogleFirst,
  chatCopy.sendFailed,
  chatCopy.loadFailed,
  chatCopy.missingClient,
  aiCopy.articleFailed,
  aiCopy.settingsFailed,
  aiCopy.loadFailed,
  aiCopy.thresholdRange,
  programCopy.couldNotAssign,
  programCopy.couldNotLog,
  programCopy.couldNotNudge,
  screenCopy.couldNotLoad,
  screenCopy.loadFailed,
  inboxCopy.windowInvalid,
  inboxCopy.emptyReply,
  inboxCopy.signIn,
  inboxCopy.notOpen,
  inboxCopy.useDraft,
  inboxCopy.badTier,
  "Choose reply or dismiss.",
  "Calendar signing is not configured.",
  "Google Calendar is not configured.",
  "Only a coach can connect Google Calendar.",
  "Google did not return a calendar connection.",
  "Enter a cutoff between 0 and 168 hours.",
  "End time must be after the start time.",
  "Choose a date and a time range.",
] as const;

const CUTOFF = /You can cancel up to \d+ hours before the session\./;

/** A product sentence buried in a technical message, or null when none matches. */
export function knownProductMessage(message: string | undefined): string | null {
  if (!message) return null;
  const sentinel = "\u0000";
  const known = productError(message, sentinel);
  if (known !== sentinel) return known;
  const extra = MORE_PRODUCT_ERRORS.filter((item) => message.includes(item)).sort((a, b) => b.length - a.length)[0];
  if (extra) return extra;
  const cutoff = message.match(CUTOFF);
  return cutoff?.[0] ?? null;
}

/**
 * Text safe to show on a screen. Only known product sentences pass through.
 * Everything else, including short database and network text, becomes the fallback.
 */
export function userFacingError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return knownProductMessage(message) ?? fallback;
}

/**
 * Membership and coach load failures. The generic product fallback is a retry
 * sentence for actions, so a screen load uses the load sentence instead.
 */
export function sessionLoadError(error: unknown): string {
  const message = userFacingError(error, screenCopy.loadFailed);
  return message === copy.generic ? screenCopy.loadFailed : message;
}

export type DeskSessionView = "checking" | "unconfigured" | "error" | "login" | "signup" | "coach" | "desk";

export function deskSessionView(input: {
  ready: boolean;
  configured: boolean;
  hasSession: boolean;
  role: string | null;
  loadError: string | null;
}): DeskSessionView {
  if (!input.ready) return "checking";
  if (!input.configured) return "unconfigured";
  if (input.loadError) return "error";
  if (!input.hasSession) return "login";
  if (!input.role) return "signup";
  if (input.role !== "trainer") return "coach";
  return "desk";
}

export type ClientSessionView = "checking" | "unconfigured" | "error" | "login" | "app";

export function clientSessionView(input: {
  ready: boolean;
  configured: boolean;
  hasSession: boolean;
  role: string | null;
  loadError: string | null;
}): ClientSessionView {
  if (!input.ready) return "checking";
  if (!input.configured) return "unconfigured";
  if (input.loadError) return "error";
  if (!input.hasSession) return "login";
  if (input.role !== "client") return "login";
  return "app";
}

export type TrainingLoad = {
  ready: boolean;
  error: string | null;
};

/** Try again hides the stale card and shows the loading sentence. */
export function trainingRetryStart(): TrainingLoad {
  return { ready: false, error: null };
}

/** A successful load clears the error. A failed load shows the load sentence. */
export function trainingRetryResult(error: unknown): TrainingLoad {
  if (!error) return { ready: true, error: null };
  return { ready: true, error: userFacingError(error, screenCopy.loadFailed) };
}

/** Queued logs keep the existing offline line. A disconnected phone still gets a banner. */
export function connectionMessage(online: boolean, pendingCount: number): string | null {
  if (pendingCount > 0) return programCopy.savedOffline;
  if (!online) return screenCopy.offline;
  return null;
}

export function offlineActionReason(online: boolean): string | null {
  return online ? null : screenCopy.offlineAction;
}

export type ScreenPreview = "loading" | "empty" | "error" | "offline";

const SCREEN_PREVIEWS: readonly ScreenPreview[] = ["loading", "empty", "error", "offline"];

/**
 * Dev-only screen fixture. Production builds ignore the query so a shared link cannot fake a session.
 * `?preview=1&state=empty` renders that screen's own empty treatment.
 */
export function screenPreviewFromSearch(
  search: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ScreenPreview | null {
  if (nodeEnv === "production") return null;
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  if (params.get("preview") !== "1") return null;
  const state = params.get("state");
  if (state && (SCREEN_PREVIEWS as readonly string[]).includes(state)) return state as ScreenPreview;
  return "empty";
}
