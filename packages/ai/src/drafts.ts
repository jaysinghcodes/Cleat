export const DRAFT_ACTIONS = ["send_edited", "send_as_is", "dismiss"] as const;

export type DraftAction = (typeof DRAFT_ACTIONS)[number];

export type DraftActionResult = {
  ok: true;
  trainerEdit: boolean;
  trainerAction: DraftAction;
  finalText: string | null;
  chatBody: string | null;
  chatKind: "human" | "ai" | null;
  status: "sent" | "dismissed";
};

export type DraftActionFailure = {
  ok: false;
  error: string;
};

export function applyTrainerDraftAction(input: {
  action: DraftAction;
  draftText: string;
  editedText?: string;
}): DraftActionResult | DraftActionFailure {
  if (input.action === "dismiss") {
    return {
      ok: true,
      trainerEdit: false,
      trainerAction: "dismiss",
      finalText: null,
      chatBody: null,
      chatKind: null,
      status: "dismissed",
    };
  }
  if (input.action === "send_as_is") {
    const body = input.draftText.trim();
    if (!body) return { ok: false, error: "There is no draft to send." };
    return {
      ok: true,
      trainerEdit: false,
      trainerAction: "send_as_is",
      finalText: body,
      chatBody: body,
      chatKind: "ai",
      status: "sent",
    };
  }
  const edited = (input.editedText ?? "").trim();
  if (!edited) return { ok: false, error: "Write a message before sending." };
  if (edited.length > 4000) return { ok: false, error: "Keep the message under 4000 characters." };
  return {
    ok: true,
    trainerEdit: true,
    trainerAction: "send_edited",
    finalText: edited,
    chatBody: edited,
    chatKind: "human",
    status: "sent",
  };
}
