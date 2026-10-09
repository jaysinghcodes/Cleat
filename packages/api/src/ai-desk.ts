import {
  aiCopy,
  aiSettingsSchema,
  buildInboxQueue,
  calendarDate,
  inboxCopy,
  missedCandidates,
  parseAiSettings,
  parseAuditEvents,
  parseHeldDraft,
  parseInboxAudits,
  parseInboxDrafts,
  parseKbArticles,
  parseStoredInboxItems,
  parseThreadHeads,
  parseTrainerNotices,
  parseUnansweredHours,
  productError,
  resolveUnansweredHours,
  type AiSettings,
  type AuditEvent,
  type HeldDraftMarker,
  type InboxQueueItem,
  type KbArticle,
  type KbCategory,
  type KbDraft,
  type TrainerNotice,
} from "@cleat/domain";
import { CleatRequestError, listClients } from "./auth";
import { fetchAccountability } from "./programs";
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

export type TrainerInbox = {
  items: InboxQueueItem[];
  windowHours: number;
  notices: TrainerNotice[];
};

const INBOX_COLUMNS =
  "id, org_id, client_id, audit_id, message_id, priority, emergency, reason_codes, title, preview, template_id, status, created_at";

/** Message ids for sent inbox rows. A sent row is a reply that reached the client. */
function coveredMessageIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const id = (row as { message_id?: unknown }).message_id;
    return typeof id === "string" && id.length > 0 ? [id] : [];
  });
}

export async function loadTrainerInbox(
  supabase: CleatClient,
  input: { orgId: string; timeZone: string; now?: string },
): Promise<TrainerInbox> {
  const now = input.now ?? new Date().toISOString();
  const [org, items, covered, heads, notices, clients, board] = await Promise.all([
    supabase.from("orgs").select("unanswered_hours").eq("id", input.orgId).maybeSingle(),
    supabase
      .from("inbox_items")
      .select(INBOX_COLUMNS)
      .eq("status", "open")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("inbox_items").select("message_id").eq("status", "sent"),
    supabase.rpc("thread_heads"),
    supabase
      .from("trainer_notices")
      .select("id, org_id, client_id, inbox_item_id, title, body, emergency, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    listClients(supabase),
    fetchAccountability(supabase, input.timeZone),
  ]);
  if (org.error) fail(org.error.message, inboxCopy.title);
  if (items.error) fail(items.error.message, aiCopy.loadFailed);
  if (covered.error) fail(covered.error.message, aiCopy.loadFailed);
  if (heads.error) fail(heads.error.message, aiCopy.loadFailed);
  if (notices.error) fail(notices.error.message, aiCopy.loadFailed);
  const stored = parseStoredInboxItems(items.data);
  const itemIds = stored.map((item) => item.id);
  const auditIds = [...new Set(stored.flatMap((item) => (item.auditId ? [item.auditId] : [])))];
  const [drafts, audits] = await Promise.all([
    itemIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("held_drafts")
          .select("id, inbox_item_id, draft_text, sources, status")
          .eq("status", "held")
          .in("inbox_item_id", itemIds),
    auditIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("audit_events").select("id, confidence, threshold, template_id, reason_codes").in("id", auditIds),
  ]);
  if (drafts.error) fail(drafts.error.message, aiCopy.loadFailed);
  if (audits.error) fail(audits.error.message, aiCopy.loadFailed);
  const windowHours = resolveUnansweredHours(
    org.data && typeof org.data === "object" ? (org.data as { unanswered_hours?: unknown }).unanswered_hours : undefined,
    process.env.INBOX_UNANSWERED_HOURS,
  );
  const names: Record<string, string> = {};
  for (const client of clients) names[client.userId] = client.displayName;
  const today = calendarDate(input.timeZone, new Date(now));
  return {
    windowHours,
    notices: parseTrainerNotices(notices.data),
    items: buildInboxQueue({
      orgId: input.orgId,
      now,
      windowHours,
      names,
      stored,
      drafts: parseInboxDrafts(drafts.data),
      audits: parseInboxAudits(audits.data),
      heads: parseThreadHeads(heads.data),
      missed: missedCandidates(board.rows, today, input.timeZone),
      coveredMessageIds: coveredMessageIds(covered.data),
    }),
  };
}

export async function saveUnansweredHours(supabase: CleatClient, orgId: string, hours: number): Promise<void> {
  const parsed = parseUnansweredHours(hours);
  if (parsed === null) throw new CleatRequestError(inboxCopy.windowInvalid);
  const { error } = await supabase.from("orgs").update({ unanswered_hours: parsed }).eq("id", orgId);
  if (error) fail(error.message, inboxCopy.windowInvalid);
}

export async function actOnHeldDraft(
  supabase: CleatClient,
  origin: string,
  input: { draftId: string; action: "send_edited" | "send_as_is" | "dismiss"; editedText?: string },
): Promise<void> {
  const token = await authHeader(supabase);
  const response = await fetch(`${origin.replace(/\/$/, "")}/api/ai/drafts`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = payload && typeof payload.error === "string" ? payload.error : aiCopy.loadFailed;
    throw new CleatRequestError(message);
  }
}

export async function resolveInboxItem(
  supabase: CleatClient,
  input: { itemId: string; action: "reply" | "dismiss"; body?: string },
): Promise<void> {
  const { error } = await supabase.rpc("resolve_inbox_item", {
    item_id: input.itemId,
    action: input.action,
    reply_body: input.body ?? "",
  });
  if (error) fail(error.message, input.action === "dismiss" ? inboxCopy.dismissed : inboxCopy.replySent);
}

export function kbCategoryOrNull(value: string): KbCategory | null {
  if (value === "safety" || value === "faq" || value === "rules") return value;
  return null;
}
