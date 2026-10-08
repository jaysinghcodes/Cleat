import { contentTokens, roundConfidence } from "./text";

/** Not configurable. Medium starts here. Below this is Low or refused. */
export const CONFIDENCE_FLOOR = 0.5;

export const DEFAULT_THRESHOLD = 0.85;

export const MIN_THRESHOLD = 0.6;

export const MAX_THRESHOLD = 0.95;

export type Band = "high" | "medium" | "low";

export type AiDecision = "auto_send" | "escalate" | "hard_refuse";

export const REASON_CODES = [
  "retrieval_gap",
  "ambiguous",
  "refusal_keyword",
  "emergency",
  "self_harm",
  "asks_for_coach",
  "program_swap",
  "auto_send_off",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type ConfidenceResult = {
  confidence: number;
  reasonCodes: ReasonCode[];
  band: Band;
};

/** Returns null when the value is outside 0.60 to 0.95. The floor is not part of this range. */
export function clampThreshold(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (rounded < MIN_THRESHOLD || rounded > MAX_THRESHOLD) return null;
  return rounded;
}

export function bandFor(confidence: number, threshold: number): Band {
  const score = Math.round(confidence * 1000) / 1000;
  const gate = Math.round(threshold * 100) / 100;
  if (score + 1e-9 >= gate) return "high";
  if (score + 1e-9 >= CONFIDENCE_FLOOR) return "medium";
  return "low";
}

/**
 * Theme CSS variables. High is muted green, medium is apricot, low or any refusal is muted red.
 * A hard refusal stays red even when the retrieval score would be High.
 */
const CONFIDENCE_FILL = {
  high: "var(--done)",
  medium: "var(--accent)",
  low: "var(--nudge)",
} as const;

export function confidenceBarColor(input: {
  confidence: number;
  threshold: number;
  decision?: AiDecision | null;
}): string {
  if (input.decision === "hard_refuse") return CONFIDENCE_FILL.low;
  return CONFIDENCE_FILL[bandFor(input.confidence, input.threshold)];
}

/**
 * Retrieval plus answerability. Token overlap is the answerability signal.
 * The canned scorer uses this directly. A live model can only blend with it.
 */
export function scoreRetrieval(
  message: string,
  chunks: { snippet: string; score: number }[],
): { confidence: number; reasonCodes: ReasonCode[] } {
  if (chunks.length === 0) {
    return { confidence: 0.2, reasonCodes: ["retrieval_gap"] };
  }
  const top = Math.max(0, Math.min(1, chunks[0]?.score ?? 0));
  const tokens = contentTokens(message);
  const blob = chunks.map((chunk) => chunk.snippet.toLowerCase()).join(" ");
  const hit =
    tokens.length === 0 ? 0 : tokens.filter((token) => blob.includes(token)).length / tokens.length;
  const confidence = roundConfidence(top * 0.45 + hit * 0.55);
  const reasonCodes: ReasonCode[] = [];
  if (hit < 0.34) reasonCodes.push("retrieval_gap");
  else if (hit < 0.67) reasonCodes.push("ambiguous");
  return { confidence, reasonCodes };
}

export function blendConfidence(retrieval: number, model: number | null): number {
  if (model == null || !Number.isFinite(model)) return roundConfidence(retrieval);
  const clamped = Math.min(1, Math.max(0, model));
  return roundConfidence(retrieval * 0.7 + clamped * 0.3);
}
