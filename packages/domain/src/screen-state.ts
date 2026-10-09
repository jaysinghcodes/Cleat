import { productError } from "./auth";
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

const TECHNICAL =
  /stack|postgres|jwt|pgrst|syntax error|typeerror|referenceerror|fetch failed|failed to fetch|network request failed|network error|econn|sqlstate|relation |violates |password authentication|invalid input|unexpected token|duplicate key|\bat [\w$.]+\s*\(|\/[\w.-]+\.(?:ts|tsx|js)\b/i;

/** A product sentence buried in a technical message, or null when none matches. */
export function knownProductMessage(message: string | undefined): string | null {
  if (!message) return null;
  const sentinel = "\u0000";
  const known = productError(message, sentinel);
  return known === sentinel ? null : known;
}

function plainCopy(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 180 || trimmed.includes("\n")) return false;
  if (TECHNICAL.test(trimmed)) return false;
  return true;
}

/**
 * Text safe to show on a screen. Known product sentences pass through.
 * Supabase, network, and stack text become the fallback.
 */
export function userFacingError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const known = knownProductMessage(message);
  if (known) return known;
  if (plainCopy(message)) return message.trim();
  return fallback;
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
