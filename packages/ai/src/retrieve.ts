import type { Embedder } from "./embeddings";
import { keywordScorer } from "./keywords";

export type ChunkSource = "kb" | "program";

export type StoredChunk = {
  id: string;
  orgId: string;
  clientId: string | null;
  snippet: string;
  embedding: number[];
  articleId: string | null;
  source: ChunkSource;
  title: string | null;
};

export type RetrievedChunk = {
  id: string;
  orgId: string;
  clientId: string | null;
  snippet: string;
  /** Rank score, 0 to 1. Vector similarity alone, or the hybrid blend when hybrid search is on. */
  score: number;
  /** Vector similarity before any blending. Set by hybrid search. */
  vectorScore?: number;
  /** Weighted share of the question's content words found in this snippet. Set by hybrid search. */
  coverage?: number;
  articleId: string | null;
  source: ChunkSource;
  title: string | null;
};

export type RetrieveOptions = {
  /** Blend keyword coverage into the vector rank. */
  hybrid?: boolean;
  /** Second pass over the blended list: reward question phrases that appear intact. */
  rerank?: boolean;
  /** How many vector candidates to fetch before blending. */
  pool?: number;
  /** Share of the rank score that comes from keyword coverage. */
  keywordWeight?: number;
  /** Bonus for intact phrases in the rerank pass. */
  phraseWeight?: number;
};

export const DEFAULT_RETRIEVE_OPTIONS: Required<RetrieveOptions> = {
  hybrid: true,
  rerank: false,
  pool: 20,
  keywordWeight: 0.5,
  phraseWeight: 0.15,
};

export type RetrieveInput = {
  orgId: string;
  clientId: string;
  message: string;
  k?: number;
  options?: RetrieveOptions;
};

export type ChunkStore = {
  search(input: {
    orgId: string;
    clientId: string;
    embedding: number[];
    k: number;
  }): Promise<RetrievedChunk[]>;
};

/** KB chunks have a null client id. Program chunks must match the asking client. */
export function chunkInScope(
  chunk: { orgId: string; clientId: string | null },
  scope: { orgId: string; clientId: string },
): boolean {
  return chunk.orgId === scope.orgId && (chunk.clientId === null || chunk.clientId === scope.clientId);
}

/**
 * Retrieves this org's KB plus this client's program chunks.
 * The store is expected to filter, and this function filters again.
 */
export async function retrieve(
  input: RetrieveInput,
  deps: { embedder: Embedder; store: ChunkStore },
): Promise<RetrievedChunk[]> {
  const k = input.k ?? 5;
  const options = { ...DEFAULT_RETRIEVE_OPTIONS, ...(input.options ?? {}) };
  const [embedding] = await deps.embedder.embed([input.message]);
  if (!embedding) return [];
  const rows = await deps.store.search({
    orgId: input.orgId,
    clientId: input.clientId,
    embedding,
    k: options.hybrid ? Math.max(k, options.pool) : k,
  });
  const scoped = rows.filter((row) => chunkInScope(row, input));
  if (!options.hybrid) {
    return scoped.sort((left, right) => right.score - left.score).slice(0, k);
  }
  return blendKeywordRank(input.message, scoped, options).slice(0, k);
}

function unit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Hybrid rank. Each vector candidate also gets a keyword coverage score, and the two are blended.
 * The keyword side forgives typos and plural endings and weighs rare words more.
 * A question with no content words keeps the vector order.
 * This runs on the candidates the vector search returned. It does not search the table by keyword.
 */
export function blendKeywordRank(
  message: string,
  rows: RetrievedChunk[],
  options: RetrieveOptions = {},
): RetrievedChunk[] {
  const settings = { ...DEFAULT_RETRIEVE_OPTIONS, ...options };
  const scorer = keywordScorer(
    message,
    rows.map((row) => row.snippet),
  );
  const weight = scorer.terms.length === 0 ? 0 : unit(settings.keywordWeight);
  return rows
    .map((row) => {
      const vector = unit(row.score);
      const match = scorer.score(row.snippet);
      const blended = (1 - weight) * vector + weight * match.coverage;
      const bonus = settings.rerank ? settings.phraseWeight * match.phrase : 0;
      return { ...row, score: unit(blended + bonus), vectorScore: vector, coverage: match.coverage };
    })
    .sort((left, right) => right.score - left.score);
}
