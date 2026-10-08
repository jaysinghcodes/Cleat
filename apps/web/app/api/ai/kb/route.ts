import { aiCopy, kbDraftSchema } from "@cleat/domain";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../lib/server/admin";
import { aiCors, aiJson, requireTrainer } from "../../../../lib/server/actor";
import { createAiRuntime } from "../../../../lib/server/openai";
import { embedArticle } from "../../../../lib/server/pipeline";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCors });
}

export async function POST(request: Request) {
  const actor = await requireTrainer(request);
  if (!actor.ok) return actor.response;
  let payload: { id?: unknown; title?: unknown; category?: unknown; body?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return aiJson({ error: aiCopy.articleFailed }, 400);
  }
  const parsed = kbDraftSchema.safeParse({
    title: payload.title,
    category: payload.category,
    body: payload.body,
  });
  if (!parsed.success) return aiJson({ error: aiCopy.articleFailed }, 400);
  const admin = createServiceRoleClient();
  if (!admin) return aiJson({ error: aiCopy.articleFailed }, 500);
  const id = typeof payload.id === "string" ? payload.id : "";
  let articleId = id;
  if (id) {
    const updated = await admin
      .from("kb_articles")
      .update({
        title: parsed.data.title,
        category: parsed.data.category,
        body: parsed.data.body,
      })
      .eq("id", id)
      .eq("org_id", actor.orgId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) return aiJson({ error: aiCopy.articleFailed }, 400);
  } else {
    const inserted = await admin
      .from("kb_articles")
      .insert({
        org_id: actor.orgId,
        title: parsed.data.title,
        category: parsed.data.category,
        body: parsed.data.body,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return aiJson({ error: aiCopy.articleFailed }, 400);
    articleId = String(inserted.data.id);
  }
  try {
    await embedArticle(admin, createAiRuntime().embedder, {
      id: articleId,
      orgId: actor.orgId,
      title: parsed.data.title,
      body: parsed.data.body,
    });
  } catch {
    return aiJson({ error: aiCopy.articleFailed }, 500);
  }
  return aiJson({ id: articleId }, 200);
}
