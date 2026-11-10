import { keywordScorer } from "./keywords";
import { roundConfidence } from "./text";

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
  "distress_wording",
  "auto_send_off",
  "low_confidence",
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

export type ConfidenceWeights = {
  /** Weight on top match strength: the vector similarity of the best note. */
  strength: number;
  /** Weight on word coverage: the weighted share of the question's content words found in the best note. */
  coverage: number;
};

/**
 * Hand set weights for a heuristic. They were picked on the dev half of the expanded
 * eval set with the offline embedder. The result is a rule of thumb score from 0 to 1.
 * It is not a probability and it has not been fitted to outcomes.
 */
export const CONFIDENCE_WEIGHTS: ConfidenceWeights = { strength: 0.1, coverage: 0.9 };

/** A question with no content words at all cannot score above this. */
export const NO_CONTENT_CEILING = 0.3;

/**
 * A thin question cannot score above this, so it is always held for the coach.
 * It sits below the lowest threshold a coach can set.
 */
export const THIN_QUESTION_CEILING = 0.55;

/** A note this close to the question is a near copy of it. The thin question rule steps aside. */
const NEAR_COPY_STRENGTH = 0.95;

const POINTS_ELSEWHERE = /\b(?:it|that|this|these|those|they|them)\b/;

/**
 * One content word, or two with a word that points at something said earlier
 * ("how does it work", "is that ok for squats"). Keyword overlap cannot tell what
 * such a message is asking, so it goes to the coach.
 */
export function isThinQuestion(message: string, termCount: number): boolean {
  if (termCount < 2) return true;
  return termCount === 2 && POINTS_ELSEWHERE.test(message.toLowerCase());
}

export type ScoredChunk = {
  snippet: string;
  /** Top match strength. Vector similarity, 0 to 1. */
  score: number;
  /** Word coverage from hybrid search, when it ran. Computed here from the snippets otherwise. */
  coverage?: number;
};

/**
 * A weighted heuristic: top match strength plus word coverage, both read from the best note.
 * Coverage counts a rare word for more than a common one, and a word no note contains
 * for the most, so a question about something the notes never mention scores low.
 * The canned scorer uses this directly. A live model can only blend with it.
 */
export function scoreRetrieval(
  message: string,
  chunks: ScoredChunk[],
  weights: ConfidenceWeights = CONFIDENCE_WEIGHTS,
): { confidence: number; reasonCodes: ReasonCode[] } {
  if (chunks.length === 0) {
    return { confidence: 0.2, reasonCodes: ["retrieval_gap"] };
  }
  const best = chunks[0];
  const top = Math.max(0, Math.min(1, best?.score ?? 0));
  const scorer = keywordScorer(
    message,
    chunks.map((chunk) => chunk.snippet),
  );
  const hit = best?.coverage ?? scorer.score(best?.snippet ?? "").coverage;
  const raw = top * weights.strength + hit * weights.coverage;
  const thin = isThinQuestion(message, scorer.terms.length) && top < NEAR_COPY_STRENGTH;
  const ceiling = scorer.terms.length === 0 ? NO_CONTENT_CEILING : thin ? THIN_QUESTION_CEILING : 1;
  const confidence = roundConfidence(Math.min(raw, ceiling));
  const reasonCodes: ReasonCode[] = [];
  if (thin) reasonCodes.push("ambiguous");
  else if (hit < 0.34) reasonCodes.push("retrieval_gap");
  else if (hit < 0.67) reasonCodes.push("ambiguous");
  return { confidence, reasonCodes };
}

export function blendConfidence(retrieval: number, model: number | null): number {
  if (model == null || !Number.isFinite(model)) return roundConfidence(retrieval);
  const clamped = Math.min(1, Math.max(0, model));
  return roundConfidence(retrieval * 0.7 + clamped * 0.3);
}
