import { clampUnansweredHours, DEFAULT_UNANSWERED_HOURS } from "@cleat/domain";

/**
 * Server default for the unanswered window.
 * A saved org window still overrides this number.
 */
export function serverInboxWindowHours(envValue: unknown): number {
  return clampUnansweredHours(envValue) ?? DEFAULT_UNANSWERED_HOURS;
}
