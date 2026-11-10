import { applyTrainerDraftAction, type DraftAction, type DraftActionResult } from "@cleat/ai";
import { aiCopy } from "@cleat/domain";

export type HeldDraftRow = {
  draftText: string;
};

export type DraftCommit =
  | { httpStatus: 200; body: { ok: true; status: DraftActionResult["status"]; noteSaved: boolean }; posted: boolean }
  | { httpStatus: 400 | 404; body: { error: string }; posted: false };

/**
 * Claim the held row before posting. A second send sees the claim fail and posts nothing.
 * saveNote runs only after an edited reply is posted. If it throws, the reply still stands
 * and the result says the note was not saved.
 */
export async function commitHeldDraft(input: {
  loaded: HeldDraftRow | null;
  action: DraftAction;
  editedText?: string;
  claim: (status: DraftActionResult["status"]) => Promise<boolean>;
  writeAudit: (result: DraftActionResult) => Promise<void>;
  postChat: (body: string, kind: "human" | "ai") => Promise<void>;
  closeInbox: (status: DraftActionResult["status"]) => Promise<void>;
  /** Saves the coach's fix as a note. Returns true when a note was written. */
  saveNote?: (edit: { draftText: string; editedText: string }) => Promise<boolean>;
}): Promise<DraftCommit> {
  if (!input.loaded) return { httpStatus: 404, body: { error: aiCopy.loadFailed }, posted: false };
  const result = applyTrainerDraftAction({
    action: input.action,
    draftText: input.loaded.draftText,
    editedText: input.editedText,
  });
  if (!result.ok) return { httpStatus: 400, body: { error: result.error }, posted: false };
  const claimed = await input.claim(result.status);
  if (!claimed) return { httpStatus: 200, body: { ok: true, status: result.status, noteSaved: false }, posted: false };
  await input.writeAudit(result);
  if (result.chatBody && result.chatKind) await input.postChat(result.chatBody, result.chatKind);
  await input.closeInbox(result.status);
  let noteSaved = false;
  if (input.saveNote && result.trainerAction === "send_edited" && result.finalText) {
    try {
      noteSaved = await input.saveNote({ draftText: input.loaded.draftText, editedText: result.finalText });
    } catch {
      noteSaved = false;
    }
  }
  return { httpStatus: 200, body: { ok: true, status: result.status, noteSaved }, posted: Boolean(result.chatBody) };
}
