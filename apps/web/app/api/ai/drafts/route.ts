import { applyTrainerDraftAction, type DraftAction } from "@cleat/ai";
import { aiCopy } from "@cleat/domain";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../lib/server/admin";
import { aiCors, aiJson, requireTrainer } from "../../../../lib/server/actor";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<DraftAction>(["send_edited", "send_as_is", "dismiss"]);

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCors });
}

export async function POST(request: Request) {
  const actor = await requireTrainer(request);
  if (!actor.ok) return actor.response;
  let payload: { action?: unknown; draftId?: unknown; editedText?: unknown };
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
    .select("id, org_id, client_id, thread_id, audit_id, inbox_item_id, draft_text, sources, status")
    .eq("id", draftId)
    .eq("org_id", actor.orgId)
    .eq("status", "held")
    .maybeSingle();
  if (loaded.error || !loaded.data) return aiJson({ error: aiCopy.loadFailed }, 404);
  const result = applyTrainerDraftAction({
    action: action as DraftAction,
    draftText: String(loaded.data.draft_text ?? ""),
    editedText: typeof payload.editedText === "string" ? payload.editedText : undefined,
  });
  if (!result.ok) return aiJson({ error: result.error }, 400);
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
    .eq("id", loaded.data.audit_id)
    .eq("org_id", actor.orgId);
  if (audit.error) return aiJson({ error: aiCopy.loadFailed }, 500);
  if (result.chatBody && result.chatKind) {
    const message = await admin.from("messages").insert({
      thread_id: loaded.data.thread_id,
      org_id: actor.orgId,
      sender_id: actor.userId,
      body: result.chatBody,
      kind: result.chatKind,
      sources: result.chatKind === "ai" ? loaded.data.sources ?? [] : [],
    });
    if (message.error) return aiJson({ error: aiCopy.loadFailed }, 500);
  }
  const status = result.status;
  await admin.from("held_drafts").update({ status }).eq("id", draftId).eq("org_id", actor.orgId);
  await admin.from("inbox_items").update({ status }).eq("id", loaded.data.inbox_item_id).eq("org_id", actor.orgId);
  return aiJson({ ok: true, status }, 200);
}
