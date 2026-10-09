import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_ARTICLES, DEMO_ORG_ID } from "../../db/src/demo-copy";
import { chunkArticle } from "./chunk";
import { hashEmbedder, type Embedder } from "./embeddings";
import { evaluateMessage, type EvalLabel } from "./eval";
import { cannedChatModel, type ChatModel } from "./models";
import { type TemplateId } from "./refusals";
import { retrieve, type StoredChunk } from "./retrieve";
import { cosineSimilarity } from "./text";

export type EvalCase = {
  id: string;
  message: string;
  expected: EvalLabel;
  templateId: TemplateId | null;
  note: string;
};

const DASH = /[—–]| - /;
const CLIENT_ID = "d1200000-0000-4000-8000-000000000001";

function evalPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../docs/eval-messages.json");
}

export function loadEvalCases(path = evalPath()): EvalCase[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Eval file must be a list.");
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Eval row ${index} is not an object.`);
    const row = item as Partial<EvalCase>;
    if (!row.id || !row.message || !row.note) throw new Error(`Eval row ${index} is missing id, message, or note.`);
    if (row.expected !== "answer" && row.expected !== "escalate" && row.expected !== "refuse") {
      throw new Error(`Eval row ${row.id} has a bad label.`);
    }
    if (row.expected === "refuse") {
      if (row.templateId !== "emergency" && row.templateId !== "emergency_self_harm" && row.templateId !== "medical_safety") {
        throw new Error(`Eval row ${row.id} is missing a refusal template.`);
      }
    } else if (row.templateId != null) {
      throw new Error(`Eval row ${row.id} should not set a template.`);
    }
    if (DASH.test(row.message) || DASH.test(row.note)) {
      throw new Error(`Eval row ${row.id} has dash punctuation.`);
    }
    return {
      id: row.id,
      message: row.message,
      expected: row.expected,
      templateId: row.templateId ?? null,
      note: row.note,
    };
  });
}

async function runtime(): Promise<{ embedder: Embedder; chat: ChatModel; mode: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { embedder: hashEmbedder, chat: cannedChatModel, mode: "offline" };
  const embedder: Embedder = {
    model: "text-embedding-3-small",
    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
      });
      if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
      const payload = (await response.json()) as { data?: { index: number; embedding: number[] }[] };
      return [...(payload.data ?? [])]
        .sort((left, right) => left.index - right.index)
        .map((row) => row.embedding);
    },
  };
  const chat: ChatModel = {
    model: "gpt-4o-mini",
    async complete(input) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Chat request failed (${response.status}).`);
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
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
  return { embedder, chat, mode: "openai" };
}

export async function runEval(cases = loadEvalCases()): Promise<{ failed: number; lines: string[] }> {
  const { embedder, chat, mode } = await runtime();
  const stored: StoredChunk[] = [];
  for (const article of DEMO_ARTICLES) {
    const snippets = chunkArticle(article.title, article.body);
    const vectors = await embedder.embed(snippets);
    snippets.forEach((snippet, index) => {
      stored.push({
        id: `${article.id}:${index}`,
        orgId: DEMO_ORG_ID,
        clientId: null,
        snippet,
        embedding: vectors[index] ?? [],
        articleId: article.id,
        source: "kb",
        title: article.title,
      });
    });
  }

  const lines: string[] = [`mode ${mode}`];
  let failed = 0;
  const totals = { answer: 0, escalate: 0, refuse: 0, passed: 0 };
  for (const item of cases) {
    const chunks = await retrieve(
      { orgId: DEMO_ORG_ID, clientId: CLIENT_ID, message: item.message, k: 5 },
      {
        embedder,
        store: {
          async search(input) {
            return stored
              .filter((chunk) => chunk.orgId === input.orgId && (chunk.clientId === null || chunk.clientId === input.clientId))
              .map((chunk) => ({
                id: chunk.id,
                orgId: chunk.orgId,
                clientId: chunk.clientId,
                snippet: chunk.snippet,
                score: cosineSimilarity(input.embedding, chunk.embedding),
                articleId: chunk.articleId,
                source: chunk.source,
                title: chunk.title,
              }))
              .sort((left, right) => right.score - left.score)
              .slice(0, input.k);
          },
        },
      },
    );
    const result = await evaluateMessage(item.message, { chunks, autoSend: true, chat });
    totals[result.label] += 1;
    const labelOk = result.label === item.expected;
    const templateOk = (result.templateId ?? null) === item.templateId;
    const ok = labelOk && templateOk;
    if (ok) totals.passed += 1;
    else failed += 1;
    const template = result.templateId ?? "";
    lines.push(
      `${ok ? "PASS" : "FAIL"}  ${item.id}  ${result.label}${template ? `  ${template}` : ""}${
        ok ? "" : `  expected ${item.expected}${item.templateId ? ` ${item.templateId}` : ""}`
      }`,
    );
  }
  lines.push("---");
  lines.push(`messages ${cases.length}`);
  lines.push(`passed ${totals.passed}`);
  lines.push(`failed ${failed}`);
  lines.push(`answer ${totals.answer}`);
  lines.push(`escalate ${totals.escalate}`);
  lines.push(`refuse ${totals.refuse}`);
  return { failed, lines };
}
