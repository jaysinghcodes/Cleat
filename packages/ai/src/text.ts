/** Shared text helpers for the offline embedder and the canned scorer. */

export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

export function roundConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(0.99, Math.max(0, value));
  return Math.round(clamped * 1000) / 1000;
}

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

export function l2normalize(values: number[]): number[] {
  let sum = 0;
  for (const value of values) sum += value * value;
  const norm = Math.sqrt(sum);
  if (norm === 0) return values.map((_, index) => (index === 0 ? 1 : 0));
  return values.map((value) => value / norm);
}

/** Cosine similarity. Both vectors are expected to be the same length and normalized. */
export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
}
