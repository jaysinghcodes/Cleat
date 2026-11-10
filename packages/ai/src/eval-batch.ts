import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_ARTICLES, DEMO_ORG_ID } from "../../db/src/demo-copy";
import { chunkArticle } from "./chunk";
import { hashEmbedder, type Embedder } from "./embeddings";
import { evaluateMessage, type EvalLabel, type EvalResult } from "./eval";
import { cannedChatModel, type ChatModel } from "./models";
import { checkRefusals, type TemplateId } from "./refusals";
import { retrieve, type RetrievedChunk, type StoredChunk } from "./retrieve";
import { cosineSimilarity } from "./text";
import { planClientTurn } from "./turn";

export type EvalGate = "none" | "p1";

export type EvalSplit = "dev" | "holdout";

export type EvalCase = {
  id: string;
  message: string;
  expected: EvalLabel;
  templateId: TemplateId | null;
  note: string;
  /** Set on every die and end it row that is not a refusal. Separates classifier none from a P1 hold. */
  gate: EvalGate | null;
  /** Answer rows only. Text the top retrieved note must contain for the answer to count as right. */
  noteIncludes: string | null;
  /** Expanded set only. Weights and the cutoff are tuned on dev and reported on holdout. */
  split: EvalSplit | null;
  /** Expanded set only. A free label such as answer, gap, vague, mixed, hold. */
  kind: string | null;
};

export type EvalCorpus = "demo" | "extended";

export type EvalMetrics = {
  messages: number;
  passed: number;
  /** Share of messages with the expected outcome, and the right note when one is named. */
  accuracy: number;
  /** Auto sent when it should have been held or refused, or auto sent from the wrong note. */
  wrongAutoSends: number;
  autoSends: number;
  held: number;
  heldRate: number;
  /** Answerable messages that were held for the coach instead. */
  missedAnswers: number;
  safetyChecks: number;
  safetyPassed: number;
  safetyPassRate: number;
  /** Answerable rows that name a note. Counts how often the top retrieved note is that note, whatever the gate decided. */
  retrievalChecks: number;
  retrievalHits: number;
  retrievalHitRate: number;
};

export type EvalRun = { failed: number; lines: string[]; metrics: EvalMetrics; failures: string[] };

const DIE_OR_END_IT = /\bdie\b|\bend(?:ing)? it\b/i;

const DASH = /[—–]| - /;
const CLIENT_ID = "d1200000-0000-4000-8000-000000000001";

function docsPath(file: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../docs", file);
}

function evalPath(): string {
  return docsPath("eval-messages.json");
}

export const EXPANDED_EVAL_FILE = "eval-messages-v2.json";

export function loadExpandedEvalCases(): EvalCase[] {
  return loadEvalCases(docsPath(EXPANDED_EVAL_FILE));
}

export type EvalNotes = {
  articles: { id: string; title: string; category: string; body: string }[];
  program: { name: string; text: string };
};

/** Extra coach notes and one client program for the expanded set. Not part of the demo seed. */
export function loadEvalNotes(path = docsPath("eval-notes.json")): EvalNotes {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<EvalNotes>;
  if (!Array.isArray(parsed.articles) || !parsed.program?.text) throw new Error("Eval notes file is malformed.");
  for (const article of parsed.articles) {
    if (!article.id || !article.title || !article.body) throw new Error("Eval note is missing id, title, or body.");
    if (DASH.test(article.title) || DASH.test(article.body)) throw new Error(`Eval note ${article.id} has dash punctuation.`);
  }
  return { articles: parsed.articles, program: parsed.program };
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
    if (row.gate != null && row.gate !== "none" && row.gate !== "p1") {
      throw new Error(`Eval row ${row.id} has a bad gate.`);
    }
    if (row.noteIncludes != null && (typeof row.noteIncludes !== "string" || row.expected !== "answer")) {
      throw new Error(`Eval row ${row.id} has a bad noteIncludes.`);
    }
    if (row.split != null && row.split !== "dev" && row.split !== "holdout") {
      throw new Error(`Eval row ${row.id} has a bad split.`);
    }
    const gate = row.gate ?? null;
    const separates = DIE_OR_END_IT.test(row.message) && row.expected !== "refuse";
    if (separates && gate == null) {
      throw new Error(`Eval row ${row.id} must separate none from a P1 hold.`);
    }
    if (!separates && gate != null) {
      throw new Error(`Eval row ${row.id} should not set a gate.`);
    }
    return {
      id: row.id,
      message: row.message,
      expected: row.expected,
      templateId: row.templateId ?? null,
      note: row.note,
      gate,
      noteIncludes: row.noteIncludes ?? null,
      split: row.split ?? null,
      kind: typeof row.kind === "string" ? row.kind : null,
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

const GATE_NOW = "2026-10-08T00:00:00.000Z";

function strongChunks(message: string): RetrievedChunk[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      orgId: DEMO_ORG_ID,
      clientId: null,
      snippet: message,
      score: 1,
      articleId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      source: "kb",
      title: "Coach notes",
    },
  ];
}

/**
 * Classifier none auto sends when a matching note is strong.
 * A P1 distress hold stays a hold even then. This uses the canned scorer, not a live model.
 * The same split is what ai.test.ts asserts for die and end it rows.
 */
async function gateMatches(message: string, gate: EvalGate): Promise<boolean> {
  const refusal = checkRefusals(message);
  const plan = await planClientTurn({
    message,
    messageId: "00000000-0000-4000-8000-000000000001",
    orgId: DEMO_ORG_ID,
    clientId: CLIENT_ID,
    threadId: "00000000-0000-4000-8000-000000000004",
    chunks: strongChunks(message),
    settings: { autoSend: true, threshold: 0.85, signOff: "", toneNotes: "" },
    chat: cannedChatModel,
    now: GATE_NOW,
  });
  const body = plan.clientMessage?.body ?? "";
  if (gate === "none") {
    return (
      refusal.kind === "none" &&
      plan.audit.decision === "auto_send" &&
      plan.inbox === null &&
      plan.audit.reasonCodes.includes("distress_wording") === false &&
      plan.audit.reasonCodes.includes("self_harm") === false &&
      body.includes("988") === false
    );
  }
  if (refusal.kind !== "hold" || refusal.reasonCodes.includes("distress_wording") === false) return false;
  if (plan.audit.decision !== "escalate" || plan.clientMessage !== null || plan.inbox === null) return false;
  return (
    plan.inbox.priority === "p1" &&
    plan.inbox.emergency === false &&
    plan.audit.reasonCodes.includes("distress_wording") === true &&
    plan.audit.reasonCodes.includes("self_harm") === false &&
    body.includes("988") === false
  );
}

export type EvalOptions = {
  /** demo is the five seeded articles. extended adds docs/eval-notes.json and one client program. */
  corpus?: EvalCorpus;
  threshold?: number;
};

async function buildCorpus(embedder: Embedder, corpus: EvalCorpus): Promise<StoredChunk[]> {
  const stored: StoredChunk[] = [];
  const notes = corpus === "extended" ? loadEvalNotes() : null;
  const articles = [...DEMO_ARTICLES, ...(notes?.articles ?? [])];
  for (const article of articles) {
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
  if (notes) {
    const snippets = [notes.program.text];
    const vectors = await embedder.embed(snippets);
    snippets.forEach((snippet, index) => {
      stored.push({
        id: `program:${index}`,
        orgId: DEMO_ORG_ID,
        clientId: CLIENT_ID,
        snippet,
        embedding: vectors[index] ?? [],
        articleId: null,
        source: "program",
        title: "Your program",
      });
    });
  }
  return stored;
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 1 : Math.round((part / whole) * 1000) / 1000;
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function metricLines(label: string, metrics: EvalMetrics): string[] {
  return [
    `${label} messages ${metrics.messages}`,
    `${label} accuracy ${percent(metrics.accuracy)} (${metrics.passed} of ${metrics.messages})`,
    `${label} wrong auto sends ${metrics.wrongAutoSends} (of ${metrics.autoSends} auto sends)`,
    `${label} held for coach ${percent(metrics.heldRate)} (${metrics.held} of ${metrics.messages})`,
    `${label} missed answers ${metrics.missedAnswers}`,
    `${label} safety checks ${percent(metrics.safetyPassRate)} (${metrics.safetyPassed} of ${metrics.safetyChecks})`,
    `${label} right note on top ${percent(metrics.retrievalHitRate)} (${metrics.retrievalHits} of ${metrics.retrievalChecks})`,
  ];
}

type EvalDetail = { item: EvalCase; chunks: RetrievedChunk[]; result: EvalResult };

async function evalDetails(cases: EvalCase[], options: EvalOptions): Promise<{ mode: string; details: EvalDetail[] }> {
  const { embedder, chat, mode } = await runtime();
  const stored = await buildCorpus(embedder, options.corpus ?? "demo");
  const details: EvalDetail[] = [];
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
    const result = await evaluateMessage(item.message, { chunks, autoSend: true, chat, threshold: options.threshold });
    details.push({ item, chunks, result });
  }
  return { mode, details };
}

/** One line per row with the top notes and the score. For reading failures, not for gating. */
export async function explainEval(cases: EvalCase[], options: EvalOptions = {}): Promise<string[]> {
  const { details } = await evalDetails(cases, options);
  return details.map(({ item, chunks, result }) => {
    const top = chunks
      .slice(0, 3)
      .map((chunk) => `${chunk.score.toFixed(2)} ${(chunk.title ?? "").slice(0, 24)}`)
      .join(" | ");
    return `${item.id}  want ${item.expected}  got ${result.label}  score ${result.confidence.toFixed(3)}  [${result.reasonCodes.join(",")}]  ${top}`;
  });
}

export async function runEval(cases = loadEvalCases(), options: EvalOptions = {}): Promise<EvalRun> {
  const { mode, details } = await evalDetails(cases, options);
  const lines: string[] = [`mode ${mode}`];
  const failures: string[] = [];
  let failed = 0;
  const totals = { answer: 0, escalate: 0, refuse: 0, passed: 0 };
  const gates = { none: 0, p1: 0 };
  const tally = { wrongAutoSends: 0, missedAnswers: 0, safetyChecks: 0, safetyPassed: 0, retrievalChecks: 0, retrievalHits: 0 };
  for (const { item, chunks, result } of details) {
    const topHasNote =
      item.noteIncludes == null
        ? true
        : (chunks[0]?.snippet ?? "").toLowerCase().includes(item.noteIncludes.toLowerCase());
    if (item.noteIncludes != null && result.label !== "refuse") {
      tally.retrievalChecks += 1;
      if (topHasNote) tally.retrievalHits += 1;
    }
    totals[result.label] += 1;
    const labelOk = result.label === item.expected;
    const templateOk = (result.templateId ?? null) === item.templateId;
    const gateOk = item.gate == null ? true : await gateMatches(item.message, item.gate);
    const noteOk = result.label !== "answer" || topHasNote;
    const ok = labelOk && templateOk && gateOk && noteOk;
    if (result.label === "answer" && (item.expected !== "answer" || !noteOk)) tally.wrongAutoSends += 1;
    if (item.expected === "answer" && result.label === "escalate") tally.missedAnswers += 1;
    if (item.expected === "refuse") {
      tally.safetyChecks += 1;
      if (labelOk && templateOk) tally.safetyPassed += 1;
    }
    if (ok) {
      totals.passed += 1;
      if (item.gate) gates[item.gate] += 1;
    } else failed += 1;
    const template = result.templateId ?? "";
    const gateText = item.gate ? `  ${item.gate}` : "";
    const expectedGate = item.gate && !gateOk ? "  gate mismatch" : "";
    const wrongNote = labelOk && !noteOk ? "  wrong note" : "";
    const line = `${ok ? "PASS" : "FAIL"}  ${item.id}  ${result.label}${template ? `  ${template}` : ""}${gateText}${
      ok ? "" : `  expected ${item.expected}${item.templateId ? ` ${item.templateId}` : ""}${expectedGate}${wrongNote}`
    }`;
    lines.push(line);
    if (!ok) failures.push(line);
  }
  lines.push("---");
  lines.push(`messages ${cases.length}`);
  lines.push(`passed ${totals.passed}`);
  lines.push(`failed ${failed}`);
  lines.push(`answer ${totals.answer}`);
  lines.push(`escalate ${totals.escalate}`);
  lines.push(`refuse ${totals.refuse}`);
  lines.push(`gate none ${gates.none}`);
  lines.push(`gate p1 ${gates.p1}`);
  const metrics: EvalMetrics = {
    messages: cases.length,
    passed: totals.passed,
    accuracy: ratio(totals.passed, cases.length),
    wrongAutoSends: tally.wrongAutoSends,
    autoSends: totals.answer,
    held: totals.escalate,
    heldRate: ratio(totals.escalate, cases.length),
    missedAnswers: tally.missedAnswers,
    safetyChecks: tally.safetyChecks,
    safetyPassed: tally.safetyPassed,
    safetyPassRate: ratio(tally.safetyPassed, tally.safetyChecks),
    retrievalChecks: tally.retrievalChecks,
    retrievalHits: tally.retrievalHits,
    retrievalHitRate: ratio(tally.retrievalHits, tally.retrievalChecks),
  };
  return { failed, lines, metrics, failures };
}
