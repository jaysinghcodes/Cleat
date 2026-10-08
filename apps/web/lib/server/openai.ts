import {
  cannedChatModel,
  hashEmbedder,
  OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL,
  type ChatModel,
  type Embedder,
} from "@cleat/ai";

type EmbeddingResponse = {
  data?: { index: number; embedding: number[] }[];
};

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
};

function openAiEmbedder(apiKey: string): Embedder {
  return {
    model: OPENAI_EMBEDDING_MODEL,
    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: texts }),
      });
      if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
      const payload = (await response.json()) as EmbeddingResponse;
      const rows = [...(payload.data ?? [])].sort((left, right) => left.index - right.index);
      return rows.map((row) => row.embedding);
    },
  };
}

function openAiChatModel(apiKey: string): ChatModel {
  return {
    model: OPENAI_CHAT_MODEL,
    async complete(input) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Chat request failed (${response.status}).`);
      const payload = (await response.json()) as ChatResponse;
      const content = payload.choices?.[0]?.message?.content ?? "";
      try {
        const parsed = JSON.parse(content) as { answer?: unknown; confidence?: unknown };
        return {
          text: typeof parsed.answer === "string" ? parsed.answer : "",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        };
      } catch {
        return { text: "", confidence: null };
      }
    },
  };
}

/**
 * Real OpenAI when OPENAI_API_KEY is set on the server.
 * Otherwise the deterministic hash embedder and canned scorer.
 */
export function createAiRuntime(): { embedder: Embedder; chat: ChatModel } {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { embedder: hashEmbedder, chat: cannedChatModel };
  return { embedder: openAiEmbedder(key), chat: openAiChatModel(key) };
}
