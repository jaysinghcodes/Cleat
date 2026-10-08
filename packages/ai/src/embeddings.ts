import { EMBEDDING_DIMS } from "./models";
import { contentTokens, l2normalize } from "./text";

export type Embedder = {
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
};

/** Offline stand-in used when OPENAI is not configured. Deterministic, 1536 dims. */
export const HASH_EMBEDDING_MODEL = "cleat-hash-embedding";

function fnv32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Bag of hashed tokens. Similar wording lands near similar vectors. */
export function hashEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMS).fill(0);
  const tokens = contentTokens(text);
  const weighted = tokens.length > 0 ? tokens : ["empty"];
  for (const token of weighted) {
    for (let salt = 0; salt < 6; salt += 1) {
      const hash = fnv32(`${token}:${salt}`);
      const dim = hash % EMBEDDING_DIMS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[dim] = (vector[dim] ?? 0) + sign;
    }
  }
  return l2normalize(vector);
}

export const hashEmbedder: Embedder = {
  model: HASH_EMBEDDING_MODEL,
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashEmbedding(text));
  },
};

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
