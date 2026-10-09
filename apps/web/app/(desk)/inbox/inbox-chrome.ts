import type { InboxReason } from "@cleat/domain";

export type InboxUrgency = "solid" | "outline" | "none";

/** Emergency is a solid urgent fill. Injury is an urgent outline and tint. */
export function inboxRowChrome(reason: InboxReason): {
  rowClass: string;
  chipClass: string;
  urgency: InboxUrgency;
  alert: boolean;
} {
  if (reason === "emergency") {
    return {
      rowClass: "list-row inbox-row inbox-row-emergency",
      chipClass: "pill pill-emergency",
      urgency: "solid",
      alert: true,
    };
  }
  if (reason === "injury") {
    return {
      rowClass: "list-row inbox-row inbox-row-injury rail-urgent",
      chipClass: "pill pill-injury",
      urgency: "outline",
      alert: false,
    };
  }
  if (reason === "ai_escalate") {
    return { rowClass: "list-row inbox-row", chipClass: "pill pill-partial", urgency: "none", alert: false };
  }
  if (reason === "unanswered") {
    return { rowClass: "list-row inbox-row", chipClass: "pill pill-skip", urgency: "none", alert: false };
  }
  return { rowClass: "list-row inbox-row", chipClass: "pill pill-nudge", urgency: "none", alert: false };
}
