import type { Embedder } from "./embeddings";

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
  score: number;
  articleId: string | null;
  source: ChunkSource;
  title: string | null;
};

export type RetrieveInput = {
  orgId: string;
  clientId: string;
  message: string;
  k?: number;
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
  const [embedding] = await deps.embedder.embed([input.message]);
  if (!embedding) return [];
  const rows = await deps.store.search({
    orgId: input.orgId,
    clientId: input.clientId,
    embedding,
    k,
  });
  return rows
    .filter((row) => chunkInScope(row, input))
    .sort((left, right) => right.score - left.score)
    .slice(0, k);
}
