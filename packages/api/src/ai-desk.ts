import {
  aiCopy,
  aiSettingsSchema,
  parseAiSettings,
  parseAuditEvents,
  parseHeldDraft,
  parseKbArticles,
  parseTrainerNotices,
  productError,
  type AiSettings,
  type AuditEvent,
  type HeldDraftMarker,
  type KbArticle,
  type KbCategory,
  type KbDraft,
  type TrainerNotice,
} from "@cleat/domain";
import { CleatRequestError } from "./auth";
import type { CleatClient } from "./supabase";

function fail(message: string | undefined, fallback: string): never {
  throw new CleatRequestError(productError(message, fallback));
}

async function authHeader(supabase: CleatClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CleatRequestError(aiCopy.loadFailed);
  return token;
}

export async function fetchAiSettings(supabase: CleatClient): Promise<AiSettings | null> {
  const { data, error } = await supabase.from("ai_settings").select("org_id, auto_send, threshold, sign_off, tone_notes");
  if (error) fail(error.message, aiCopy.loadFailed);
  return parseAiSettings(data);
}

export async function saveAiSettings(
  supabase: CleatClient,
  input: Pick<AiSettings, "orgId" | "autoSend" | "threshold" | "signOff" | "toneNotes">,
): Promise<void> {
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) throw new CleatRequestError(aiCopy.thresholdRange);
  const { error } = await supabase
    .from("ai_settings")
    .update({
      auto_send: parsed.data.autoSend,
      threshold: parsed.data.threshold,
      sign_off: parsed.data.signOff.trim(),
      tone_notes: parsed.data.toneNotes.trim(),
    })
    .eq("org_id", parsed.data.orgId);
  if (error) fail(error.message, aiCopy.settingsFailed);
}

export async function listKbArticles(supabase: CleatClient): Promise<KbArticle[]> {
  const [articles, chunks, audits] = await Promise.all([
    supabase.from("kb_articles").select("id, org_id, title, category, body, updated_at").order("updated_at", { ascending: false }),
    supabase.from("chunks").select("id, article_id").eq("source", "kb"),
    supabase.from("audit_events").select("chunks"),
  ]);
  if (articles.error) fail(articles.error.message, aiCopy.loadFailed);
  if (chunks.error) fail(chunks.error.message, aiCopy.loadFailed);
  if (audits.error) fail(audits.error.message, aiCopy.loadFailed);
  const byArticle = new Map<string, string[]>();
  for (const row of Array.isArray(chunks.data) ? chunks.data : []) {
    const articleId = typeof row.article_id === "string" ? row.article_id : "";
    const id = typeof row.id === "string" ? row.id : "";
    if (!articleId || !id) continue;
    const list = byArticle.get(articleId) ?? [];
    list.push(id);
    byArticle.set(articleId, list);
  }
  const used = new Map<string, number>();
  for (const row of Array.isArray(audits.data) ? audits.data : []) {
    const raw = row.chunks;
    if (!Array.isArray(raw)) continue;
    const ids = new Set(raw.flatMap((item) => (item && typeof item === "object" && "id" in item && typeof item.id === "string" ? [item.id] : [])));
    for (const [articleId, chunkIds] of byArticle) {
      if (chunkIds.some((id) => ids.has(id))) used.set(articleId, (used.get(articleId) ?? 0) + 1);
    }
  }
  return parseKbArticles(articles.data).map((article) => ({ ...article, usedIn: used.get(article.id) ?? 0 }));
}

export async function saveKbArticle(
  supabase: CleatClient,
  origin: string,
  draft: KbDraft & { id?: string },
): Promise<void> {
  const token = await authHeader(supabase);
  const response = await fetch(`${origin.replace(/\/$/, "")}/api/ai/kb`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = payload && typeof payload.error === "string" ? payload.error : aiCopy.articleFailed;
    throw new CleatRequestError(message);
  }
}

export async function embedAssignedProgram(supabase: CleatClient, origin: string, programId: string): Promise<void> {
  const token = await authHeader(supabase);
  await fetch(`${origin.replace(/\/$/, "")}/api/ai/embed-program`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ programId }),
  });
}

export async function listAuditEvents(
  supabase: CleatClient,
  filter?: { clientId?: string; decision?: AuditEvent["decision"] },
): Promise<AuditEvent[]> {
  let query = supabase
    .from("audit_events")
    .select(
      "id, org_id, client_id, message_id, chunks, draft_text, confidence, threshold, reason_codes, decision, template_id, delivered_at, trainer_edit, trainer_action, final_text, model, prompt_version, created_at, trainer_acted_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter?.clientId) query = query.eq("client_id", filter.clientId);
  if (filter?.decision) query = query.eq("decision", filter.decision);
  const { data, error } = await query;
  if (error) fail(error.message, aiCopy.loadFailed);
  return parseAuditEvents(data);
}

export async function listTrainerNotices(supabase: CleatClient): Promise<TrainerNotice[]> {
  const { data, error } = await supabase
    .from("trainer_notices")
    .select("id, org_id, client_id, inbox_item_id, title, body, emergency, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail(error.message, aiCopy.loadFailed);
  return parseTrainerNotices(data);
}

export async function markNoticeRead(supabase: CleatClient, id: string): Promise<void> {
  const { error } = await supabase.from("trainer_notices").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error.message, aiCopy.loadFailed);
}

export async function fetchOpenDraft(supabase: CleatClient, clientId: string): Promise<HeldDraftMarker | null> {
  const { data, error } = await supabase
    .from("held_drafts")
    .select("id, inbox_item_id, draft_text, status, created_at")
    .eq("client_id", clientId)
    .eq("status", "held")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(error.message, aiCopy.loadFailed);
  return parseHeldDraft(data);
}

export function kbCategoryOrNull(value: string): KbCategory | null {
  if (value === "safety" || value === "faq" || value === "rules") return value;
  return null;
}
