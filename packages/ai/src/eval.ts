import { DEFAULT_THRESHOLD, type ReasonCode } from "./confidence";
import { cannedChatModel, type ChatModel } from "./models";
import type { TemplateId } from "./refusals";
import type { RetrievedChunk } from "./retrieve";
import { planClientTurn, type TurnSettings } from "./turn";

export type EvalLabel = "answer" | "escalate" | "refuse";

export type EvalContext = {
  autoSend?: boolean;
  threshold?: number;
  chunks?: RetrievedChunk[];
  signOff?: string;
  toneNotes?: string;
  chat?: ChatModel;
};

export type EvalResult = {
  label: EvalLabel;
  templateId: TemplateId | null;
};

export type EvalDetailResult = EvalResult & {
  /** The heuristic score behind the decision. Not a probability. */
  confidence: number;
  reasonCodes: ReasonCode[];
};

/** Ticket 7 calls this with the eval set. Refusals include the template id. */
export async function evaluateMessage(message: string, context: EvalContext = {}): Promise<EvalResult> {
  const { label, templateId } = await evaluateMessageDetail(message, context);
  return { label, templateId };
}

/** The same gate as evaluateMessage, with the score and reason codes kept for eval reports. */
export async function evaluateMessageDetail(message: string, context: EvalContext = {}): Promise<EvalDetailResult> {
  const settings: TurnSettings = {
    autoSend: context.autoSend ?? true,
    threshold: context.threshold ?? DEFAULT_THRESHOLD,
    signOff: context.signOff ?? "",
    toneNotes: context.toneNotes ?? "",
  };
  const plan = await planClientTurn({
    message,
    messageId: "00000000-0000-4000-8000-000000000001",
    orgId: "00000000-0000-4000-8000-000000000002",
    clientId: "00000000-0000-4000-8000-000000000003",
    threadId: "00000000-0000-4000-8000-000000000004",
    chunks: context.chunks ?? [],
    settings,
    chat: context.chat ?? cannedChatModel,
    now: "2026-10-08T00:00:00.000Z",
  });
  const detail = { confidence: plan.audit.confidence, reasonCodes: plan.audit.reasonCodes };
  if (plan.audit.decision === "hard_refuse") {
    return { label: "refuse", templateId: plan.audit.templateId, ...detail };
  }
  if (plan.audit.decision === "auto_send") return { label: "answer", templateId: null, ...detail };
  return { label: "escalate", templateId: null, ...detail };
}
