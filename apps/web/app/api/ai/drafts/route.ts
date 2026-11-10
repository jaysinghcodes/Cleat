import { learnedNoteFromEdit, type DraftAction } from "@cleat/ai";
import { aiCopy } from "@cleat/domain";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../lib/server/admin";
import { aiCors, aiJson, requireTrainer } from "../../../../lib/server/actor";
import { commitHeldDraft } from "../../../../lib/server/draft-commit";
import { createAiRuntime } from "../../../../lib/server/openai";
import { embedArticle } from "../../../../lib/server/pipeline";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<DraftAction>(["send_edited", "send_as_is", "dismiss"]);

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCors });
}

export async function POST(request: Request) {
  const actor = await requireTrainer(request);
  if (!actor.ok) return actor.response;
  let payload: { action?: unknown; draftId?: unknown; editedText?: unknown; saveAsNote?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return aiJson({ error: aiCopy.loadFailed }, 400);
  }
  const action = payload.action;
  const draftId = typeof payload.draftId === "string" ? payload.draftId : "";
  if (!draftId || typeof action !== "string" || !ACTIONS.has(action as DraftAction)) {
    return aiJson({ error: aiCopy.loadFailed }, 400);
  }
  const admin = createServiceRoleClient();
  if (!admin) return aiJson({ error: aiCopy.loadFailed }, 500);
  const loaded = await admin
    .from("held_drafts")
    .select("id, org_id, client_id, thread_id, message_id, audit_id, inbox_item_id, draft_text, sources, status")
    .eq("id", draftId)
    .eq("org_id", actor.orgId)
    .eq("status", "held")
    .maybeSingle();
  if (loaded.error) return aiJson({ error: aiCopy.loadFailed }, 500);
  const row = loaded.data;
  try {
    const commit = await commitHeldDraft({
      loaded: row ? { draftText: String(row.draft_text ?? "") } : null,
      action: action as DraftAction,
      editedText: typeof payload.editedText === "string" ? payload.editedText : undefined,
      claim: async (status) => {
        const claimed = await admin
          .from("held_drafts")
          .update({ status })
          .eq("id", draftId)
          .eq("org_id", actor.orgId)
          .eq("status", "held")
          .select("id")
          .maybeSingle();
        if (claimed.error) throw new Error(claimed.error.message);
        return Boolean(claimed.data);
      },
      writeAudit: async (result) => {
        const actedAt = new Date().toISOString();
        const audit = await admin
          .from("audit_events")
          .update({
            trainer_edit: result.trainerEdit,
            trainer_action: result.trainerAction,
            final_text: result.finalText,
            trainer_acted_at: actedAt,
            delivered_at: result.chatBody ? actedAt : null,
          })
          .eq("id", row?.audit_id)
          .eq("org_id", actor.orgId);
        if (audit.error) throw new Error(audit.error.message);
      },
      postChat: async (body, kind) => {
        const message = await admin.from("messages").insert({
          thread_id: row?.thread_id,
          org_id: actor.orgId,
          sender_id: actor.userId,
          body,
          kind,
          sources: kind === "ai" ? row?.sources ?? [] : [],
        });
        if (message.error) throw new Error(message.error.message);
      },
      closeInbox: async (status) => {
        const inbox = await admin.from("inbox_items").update({ status }).eq("id", row?.inbox_item_id).eq("org_id", actor.orgId);
        if (inbox.error) throw new Error(inbox.error.message);
      },
      saveNote:
        payload.saveAsNote === true
          ? async (edit) => {
              // The question is read from the stored client message, never from the request.
              const asked = await admin
                .from("messages")
                .select("body")
                .eq("id", row?.message_id)
                .eq("org_id", actor.orgId)
                .maybeSingle();
              if (asked.error || !asked.data) return false;
              const built = learnedNoteFromEdit({ question: String(asked.data.body ?? ""), ...edit });
              if (!built.ok) return false;
              const inserted = await admin
                .from("kb_articles")
                .insert({
                  org_id: actor.orgId,
                  title: built.note.title,
                  category: built.note.category,
                  body: built.note.body,
                  created_by: actor.userId,
                })
                .select("id")
                .single();
              if (inserted.error || !inserted.data) return false;
              await embedArticle(admin, createAiRuntime().embedder, {
                id: String(inserted.data.id),
                orgId: actor.orgId,
                title: built.note.title,
                body: built.note.body,
              });
              return true;
            }
          : undefined,
    });
    return aiJson(commit.body, commit.httpStatus);
  } catch {
    return aiJson({ error: aiCopy.loadFailed }, 500);
  }
}
