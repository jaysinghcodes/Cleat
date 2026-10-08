import { DEFAULT_THRESHOLD } from "./confidence";
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

/** Ticket 7 calls this with the eval set. Refusals include the template id. */
export async function evaluateMessage(message: string, context: EvalContext = {}): Promise<EvalResult> {
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
  if (plan.audit.decision === "hard_refuse") {
    return { label: "refuse", templateId: plan.audit.templateId };
  }
  if (plan.audit.decision === "auto_send") return { label: "answer", templateId: null };
  return { label: "escalate", templateId: null };
}
