export { chunkArticle } from "./chunk";
export {
  CONFIDENCE_FLOOR,
  DEFAULT_THRESHOLD,
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  REASON_CODES,
  bandFor,
  blendConfidence,
  clampThreshold,
  scoreRetrieval,
} from "./confidence";
export type { AiDecision, Band, ConfidenceResult, ReasonCode } from "./confidence";
export { applyTrainerDraftAction, DRAFT_ACTIONS } from "./drafts";
export type { DraftAction, DraftActionFailure, DraftActionResult } from "./drafts";
export { HASH_EMBEDDING_MODEL, hashEmbedder, hashEmbedding, toVectorLiteral } from "./embeddings";
export type { Embedder } from "./embeddings";
export { evaluateMessage } from "./eval";
export type { EvalContext, EvalLabel, EvalResult } from "./eval";
export {
  CANNED_CHAT_MODEL,
  EMBEDDING_DIMS,
  OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL,
  cannedChatModel,
  cannedDraft,
} from "./models";
export type { ChatCompletion, ChatModel } from "./models";
export { PROMPT_VERSION, buildPrompt } from "./prompts";
export {
  EMERGENCY_SELF_HARM_TEMPLATE,
  EMERGENCY_TEMPLATE,
  MEDICAL_SAFETY_TEMPLATE,
  SELF_HARM_LINE,
  TEMPLATE_IDS,
  TEMPLATE_TEXT,
  checkRefusals,
} from "./refusals";
export type { DraftHold, HardRefusal, RefusalCheck, TemplateId } from "./refusals";
export { chunkInScope, retrieve } from "./retrieve";
export type { ChunkSource, ChunkStore, RetrieveInput, RetrievedChunk, StoredChunk } from "./retrieve";
export { planClientTurn, sourcesFromChunks } from "./turn";
export type { AiPlan, AuditChunk, AuditDraft, InboxDraft, TurnSettings, TurnSource } from "./turn";
