export type RetrieveInput = {
  orgId: string;
  clientId: string;
  message: string;
};

export type RetrievedChunk = {
  id: string;
  snippet: string;
};

/** Ticket 4 retrieves this org's KB and this client's program only. */
export function retrieve(_input: RetrieveInput): RetrievedChunk[] {
  return [];
}
