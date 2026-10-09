import {
  bandFor,
  blendConfidence,
  scoreRetrieval,
  type AiDecision,
  type Band,
  type ReasonCode,
} from "./confidence";
import type { ChatModel } from "./models";
import { buildPrompt } from "./prompts";
import { PROMPT_VERSION } from "./prompts";
import { checkRefusals, type TemplateId } from "./refusals";
import type { RetrievedChunk } from "./retrieve";

export type TurnSettings = {
  autoSend: boolean;
  threshold: number;
  signOff: string;
  toneNotes: string;
};

export type AuditChunk = {
  id: string;
  snippet: string;
  score: number;
};

export type TurnSource = {
  title: string;
  articleId: string | null;
};

export type AuditDraft = {
  orgId: string;
  clientId: string;
  messageId: string;
  chunks: AuditChunk[];
  draftText: string;
  confidence: number;
  threshold: number;
  reasonCodes: ReasonCode[];
  decision: AiDecision;
  templateId: TemplateId | null;
  deliveredAt: string | null;
  trainerEdit: boolean | null;
  trainerAction: null;
  finalText: string | null;
  model: string;
  promptVersion: typeof PROMPT_VERSION;
  createdAt: string;
};

export type InboxDraft = {
  priority: "p0" | "p1";
  emergency: boolean;
  reasonCodes: ReasonCode[];
  title: string;
};

export type AiPlan = {
  audit: AuditDraft;
  band: Band;
  clientMessage: { body: string; sources: TurnSource[]; kind: "ai" } | null;
  inbox: InboxDraft | null;
  holdDraft: { draftText: string; sources: TurnSource[] } | null;
  notice: { title: string; body: string; emergency: boolean } | null;
};

function uniqueCodes(codes: ReasonCode[]): ReasonCode[] {
  const seen = new Set<ReasonCode>();
  const result: ReasonCode[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

/** Chunks this far below the best match are not cited. */
const SOURCE_SCORE_GAP = 0.12;

export function sourcesFromChunks(chunks: RetrievedChunk[]): TurnSource[] {
  const ranked = [...chunks].sort((left, right) => right.score - left.score);
  const best = ranked[0]?.score ?? 0;
  const relevant = ranked.filter((chunk) => chunk.score + 1e-9 >= best - SOURCE_SCORE_GAP);
  const sources: TurnSource[] = [];
  const seen = new Set<string>();
  let program = false;
  for (const chunk of relevant) {
    if (chunk.source === "program") {
      program = true;
      continue;
    }
    if (!chunk.articleId) continue;
    if (seen.has(chunk.articleId)) continue;
    seen.add(chunk.articleId);
    sources.push({ title: chunk.title?.trim() || "Coach notes", articleId: chunk.articleId });
  }
  if (program) sources.push({ title: "Your program", articleId: null });
  if (sources.length === 0 && chunks.length > 0) {
    sources.push({ title: "Coach notes", articleId: null });
  }
  return sources;
}

function inboxTitle(input: {
  emergency: boolean;
  templateId: TemplateId | null;
  reasonCodes: ReasonCode[];
}): string {
  if (input.emergency) return "Emergency";
  if (input.templateId === "medical_safety") return "Medical safety";
  if (input.reasonCodes.includes("asks_for_coach")) return "Asked for you";
  if (input.reasonCodes.includes("program_swap")) return "Program swap";
  return "Draft held";
}

function noticeBody(title: string): string {
  if (title === "Emergency") return "A client message needs you now. The safety reply was sent.";
  if (title === "Medical safety") return "A client message was refused. The safety reply was sent.";
  if (title === "Asked for you") return "A client asked for you. The draft is held.";
  if (title === "Program swap") return "A client asked to change programs. The draft is held.";
  return "A draft is held. The client has not received it.";
}

const HELD_WITHOUT_NOTES = "I do not have that in your coach's notes yet.";

function planRetrievalFailure(
  input: {
    message: string;
    messageId: string;
    orgId: string;
    clientId: string;
    settings: TurnSettings;
    chat: ChatModel;
    now: string;
  },
  extra: ReasonCode[],
): AiPlan {
  const retrieval = scoreRetrieval(input.message, []);
  const reasonCodes = uniqueCodes([...retrieval.reasonCodes, ...extra]);
  const title = inboxTitle({ emergency: false, templateId: null, reasonCodes });
  return {
    audit: {
      orgId: input.orgId,
      clientId: input.clientId,
      messageId: input.messageId,
      chunks: [],
      draftText: HELD_WITHOUT_NOTES,
      confidence: retrieval.confidence,
      threshold: input.settings.threshold,
      reasonCodes,
      decision: "escalate",
      templateId: null,
      deliveredAt: null,
      trainerEdit: null,
      trainerAction: null,
      finalText: null,
      model: input.chat.model,
      promptVersion: PROMPT_VERSION,
      createdAt: input.now,
    },
    band: "low",
    clientMessage: null,
    inbox: { priority: "p1", emergency: false, reasonCodes, title },
    holdDraft: { draftText: HELD_WITHOUT_NOTES, sources: [] },
    notice: { title, body: noticeBody(title), emergency: false },
  };
}

/**
 * Refusals are decided on the raw message before any embed or retrieval.
 * A hard refusal never calls loadChunks. If loading chunks throws, the turn
 * is still an escalate hold and nothing is posted to the client.
 */
export async function gateClientMessage(input: {
  message: string;
  messageId: string;
  orgId: string;
  clientId: string;
  threadId: string;
  settings: TurnSettings;
  chat: ChatModel;
  now: string;
  loadChunks: () => Promise<RetrievedChunk[]>;
}): Promise<AiPlan> {
  const { loadChunks, ...turn } = input;
  const refusal = checkRefusals(input.message);
  if (refusal.kind === "hard_refuse") {
    return planClientTurn({ ...turn, chunks: [] });
  }
  try {
    const chunks = await loadChunks();
    return planClientTurn({ ...turn, chunks });
  } catch {
    return planRetrievalFailure(turn, refusal.kind === "hold" ? refusal.reasonCodes : []);
  }
}

/**
 * One AI action: retrieve is already done. This scores, refuses, and plans the writes.
 * Hard refusals never call the chat model.
 */
export async function planClientTurn(input: {
  message: string;
  messageId: string;
  orgId: string;
  clientId: string;
  threadId: string;
  chunks: RetrievedChunk[];
  settings: TurnSettings;
  chat: ChatModel;
  now: string;
}): Promise<AiPlan> {
  void input.threadId;
  const refusal = checkRefusals(input.message);
  const retrieval = scoreRetrieval(
    input.message,
    input.chunks.map((chunk) => ({ snippet: chunk.snippet, score: chunk.score })),
  );
  const sources = sourcesFromChunks(input.chunks);
  const auditChunks: AuditChunk[] = input.chunks.map((chunk) => ({
    id: chunk.id,
    snippet: chunk.snippet.slice(0, 500),
    score: Math.round(chunk.score * 1000) / 1000,
  }));

  if (refusal.kind === "hard_refuse") {
    const reasonCodes = uniqueCodes(refusal.reasonCodes);
    const title = inboxTitle({
      emergency: refusal.emergency,
      templateId: refusal.templateId,
      reasonCodes,
    });
    const audit: AuditDraft = {
      orgId: input.orgId,
      clientId: input.clientId,
      messageId: input.messageId,
      chunks: auditChunks,
      draftText: refusal.text,
      confidence: retrieval.confidence,
      threshold: input.settings.threshold,
      reasonCodes,
      decision: "hard_refuse",
      templateId: refusal.templateId,
      deliveredAt: input.now,
      trainerEdit: null,
      trainerAction: null,
      finalText: refusal.text,
      model: input.chat.model,
      promptVersion: PROMPT_VERSION,
      createdAt: input.now,
    };
    return {
      audit,
      band: "low",
      clientMessage: { body: refusal.text, sources: [], kind: "ai" },
      inbox: { priority: "p0", emergency: refusal.emergency, reasonCodes, title },
      holdDraft: null,
      notice: { title, body: noticeBody(title), emergency: refusal.emergency },
    };
  }

  const prompt = buildPrompt({
    message: input.message,
    snippets: input.chunks.map((chunk) => chunk.snippet),
    toneNotes: input.settings.toneNotes,
    signOff: "",
  });
  const completion = await input.chat.complete(prompt);
  const confidence = blendConfidence(retrieval.confidence, completion.confidence);
  const band = bandFor(confidence, input.settings.threshold);
  const signOff = input.settings.signOff.trim();
  const draftBody = completion.text.trim() || HELD_WITHOUT_NOTES;
  const draftText = signOff ? `${draftBody}\n${signOff}` : draftBody;
  const reasonCodes = uniqueCodes([
    ...retrieval.reasonCodes,
    ...(refusal.kind === "hold" ? refusal.reasonCodes : []),
  ]);
  const forcedHold = refusal.kind === "hold";
  const autoSendOff = band === "high" && !input.settings.autoSend && !forcedHold;
  if (band !== "high") reasonCodes.push("low_confidence");
  if (autoSendOff) reasonCodes.push("auto_send_off");

  const base = {
    orgId: input.orgId,
    clientId: input.clientId,
    messageId: input.messageId,
    chunks: auditChunks,
    draftText,
    confidence,
    threshold: input.settings.threshold,
    model: input.chat.model,
    promptVersion: PROMPT_VERSION,
    createdAt: input.now,
    trainerEdit: null,
    trainerAction: null as null,
    templateId: null,
  };

  if (!forcedHold && band === "high" && input.settings.autoSend) {
    return {
      audit: {
        ...base,
        reasonCodes,
        decision: "auto_send",
        deliveredAt: input.now,
        finalText: draftText,
      },
      band,
      clientMessage: { body: draftText, sources, kind: "ai" },
      inbox: null,
      holdDraft: null,
      notice: null,
    };
  }

  const title = inboxTitle({ emergency: false, templateId: null, reasonCodes });
  return {
    audit: {
      ...base,
      reasonCodes,
      decision: "escalate",
      deliveredAt: null,
      finalText: null,
    },
    band,
    clientMessage: null,
    inbox: { priority: "p1", emergency: false, reasonCodes, title },
    holdDraft: { draftText, sources },
    notice: { title, body: noticeBody(title), emergency: false },
  };
}
