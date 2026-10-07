export type AiDecision = "auto_send" | "escalate" | "hard_refuse";

export type ConfidenceResult = {
  implemented: false;
  decision: AiDecision;
};

/** Ticket 4 scores retrieval and answerability. This stub never auto-sends. */
export function scoreConfidence(): ConfidenceResult {
  return { implemented: false, decision: "escalate" };
}
