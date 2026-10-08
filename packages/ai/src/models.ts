/** Production embedding width for text-embedding-3-small. The offline hash uses the same width. */
export const EMBEDDING_DIMS = 1536;

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

export type ChatCompletion = {
  text: string;
  /** Null when this model does not score. The gate then uses retrieval only. */
  confidence: number | null;
};

export type ChatModel = {
  readonly model: string;
  complete(input: { system: string; user: string }): Promise<ChatCompletion>;
};

export const CANNED_CHAT_MODEL = "cleat-canned-scorer";

export type CannedPromptPayload = {
  message: string;
  snippets: string[];
  signOff: string;
};

export function cannedDraft(snippets: string[], signOff: string): string {
  const top = snippets.map((snippet) => snippet.trim()).find((snippet) => snippet.length > 0);
  const answer = top
    ? `From your coach's notes: ${top}`
    : "I do not have that in your coach's notes yet.";
  const note = signOff.trim();
  return note ? `${answer}\n${note}` : answer;
}

/** Deterministic chat stand-in. It quotes the top note and never writes a safety template. */
export const cannedChatModel: ChatModel = {
  model: CANNED_CHAT_MODEL,
  async complete(input: { system: string; user: string }): Promise<ChatCompletion> {
    void input.system;
    try {
      const payload = JSON.parse(input.user) as Partial<CannedPromptPayload>;
      const snippets = Array.isArray(payload.snippets) ? payload.snippets.filter((item) => typeof item === "string") : [];
      return {
        text: cannedDraft(snippets, typeof payload.signOff === "string" ? payload.signOff : ""),
        confidence: null,
      };
    } catch {
      return { text: cannedDraft([], ""), confidence: null };
    }
  },
};
