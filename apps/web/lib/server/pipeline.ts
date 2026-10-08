import {
  chunkArticle,
  gateClientMessage,
  planClientTurn,
  retrieve,
  toVectorLiteral,
  type Embedder,
  type RetrievedChunk,
} from "@cleat/ai";
import type { ClientMessageEvent } from "@cleat/api";
import { DEFAULT_AI_SETTINGS, parseAiSettings, programSourceText, type ProgramDay } from "@cleat/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "./admin";
import { createAiRuntime } from "./openai";

type Row = Record<string, unknown>;

function rows(data: unknown): Row[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Row => Boolean(row) && typeof row === "object");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function fit(snippet: string): string {
  const clean = snippet.trim();
  return clean.length > 4000 ? clean.slice(0, 4000) : clean;
}

async function replaceChunks(
  admin: SupabaseClient,
  input: {
    orgId: string;
    clientId: string | null;
    source: "kb" | "program";
    articleId: string | null;
    programId: string | null;
    snippets: string[];
    embedder: Embedder;
  },
): Promise<void> {
  const snippets = input.snippets.map(fit).filter((snippet) => snippet.length > 0);
  if (snippets.length === 0) return;
  const vectors = await input.embedder.embed(snippets);
  if (input.source === "kb" && input.articleId) {
    await admin.from("chunks").delete().eq("article_id", input.articleId);
  }
  if (input.source === "program" && input.clientId) {
    await admin.from("chunks").delete().eq("client_id", input.clientId).eq("source", "program");
  }
  const payload = snippets.map((snippet, position) => ({
    org_id: input.orgId,
    client_id: input.clientId,
    source: input.source,
    article_id: input.articleId,
    program_id: input.programId,
    position,
    snippet,
    embedding: toVectorLiteral(vectors[position] ?? []),
    model: input.embedder.model,
  }));
  const { error } = await admin.from("chunks").insert(payload);
  if (error) throw new Error(error.message);
}

export async function embedArticle(
  admin: SupabaseClient,
  embedder: Embedder,
  article: { id: string; orgId: string; title: string; body: string },
): Promise<void> {
  await replaceChunks(admin, {
    orgId: article.orgId,
    clientId: null,
    source: "kb",
    articleId: article.id,
    programId: null,
    snippets: chunkArticle(article.title, article.body),
    embedder,
  });
}

export async function embedProgramById(
  admin: SupabaseClient,
  embedder: Embedder,
  orgId: string,
  programId: string,
): Promise<void> {
  const program = await admin
    .from("programs")
    .select("id, org_id, client_id, name")
    .eq("id", programId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (program.error || !program.data) return;
  const clientId = text(program.data.client_id);
  const [days, exercises] = await Promise.all([
    admin.from("program_days").select("id, position, name, is_rest").eq("program_id", programId),
    admin.from("program_exercises").select("id, day_id, position, name, sets, reps, notes").eq("program_id", programId),
  ]);
  const dayRows = rows(days.data);
  const exerciseRows = rows(exercises.data);
  const graph: ProgramDay[] = dayRows.map((day) => ({
    id: text(day.id),
    position: Number(day.position) || 0,
    name: text(day.name),
    rest: day.is_rest === true,
    exercises: exerciseRows
      .filter((exercise) => exercise.day_id === day.id)
      .map((exercise) => ({
        id: text(exercise.id),
        position: Number(exercise.position) || 0,
        name: text(exercise.name),
        sets: Number(exercise.sets) || 1,
        reps: text(exercise.reps),
        notes: text(exercise.notes),
        videoUrl: null,
      })),
  }));
  const source = programSourceText({ name: text(program.data.name), days: graph });
  await replaceChunks(admin, {
    orgId,
    clientId,
    source: "program",
    articleId: null,
    programId,
    snippets: [source],
    embedder,
  });
}

async function ensureProgramChunks(
  admin: SupabaseClient,
  embedder: Embedder,
  orgId: string,
  clientId: string,
): Promise<void> {
  const program = await admin
    .from("programs")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (program.error || !program.data) return;
  const programId = text(program.data.id);
  const existing = await admin.from("chunks").select("id").eq("program_id", programId).limit(1);
  if (existing.data && existing.data.length > 0) return;
  await embedProgramById(admin, embedder, orgId, programId);
}

function mapMatch(data: unknown): RetrievedChunk[] {
  return rows(data).flatMap((row) => {
    const id = text(row.id);
    const orgId = text(row.org_id);
    const snippet = text(row.snippet);
    if (!id || !orgId || !snippet) return [];
    const source = row.source === "program" ? "program" : "kb";
    return [
      {
        id,
        orgId,
        clientId: typeof row.client_id === "string" ? row.client_id : null,
        snippet,
        score: Number(row.score) || 0,
        articleId: typeof row.article_id === "string" ? row.article_id : null,
        source,
        title: typeof row.title === "string" ? row.title : source === "program" ? "Your program" : null,
      },
    ];
  });
}

async function commitPlan(
  admin: SupabaseClient,
  event: ClientMessageEvent,
  plan: Awaited<ReturnType<typeof planClientTurn>>,
): Promise<void> {
  const audit = await admin
    .from("audit_events")
    .insert({
      org_id: plan.audit.orgId,
      client_id: plan.audit.clientId,
      message_id: plan.audit.messageId,
      chunks: plan.audit.chunks,
      draft_text: plan.audit.draftText,
      confidence: plan.audit.confidence,
      threshold: plan.audit.threshold,
      reason_codes: plan.audit.reasonCodes,
      decision: plan.audit.decision,
      template_id: plan.audit.templateId,
      delivered_at: plan.audit.deliveredAt,
      trainer_edit: plan.audit.trainerEdit,
      trainer_action: plan.audit.trainerAction,
      final_text: plan.audit.finalText,
      model: plan.audit.model,
      prompt_version: plan.audit.promptVersion,
      created_at: plan.audit.createdAt,
    })
    .select("id")
    .single();
  if (audit.error || !audit.data) throw new Error(audit.error?.message ?? "audit insert failed");
  const auditId = text(audit.data.id);

  if (plan.clientMessage) {
    const trainer = await admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", event.orgId)
      .eq("role", "trainer")
      .limit(1)
      .maybeSingle();
    const trainerId = trainer.data ? text(trainer.data.user_id) : "";
    if (!trainerId) throw new Error("trainer missing");
    const message = await admin.from("messages").insert({
      thread_id: event.threadId,
      org_id: event.orgId,
      sender_id: trainerId,
      body: plan.clientMessage.body,
      kind: "ai",
      sources: plan.clientMessage.sources,
    });
    if (message.error) throw new Error(message.error.message);
  }

  if (!plan.inbox) return;
  const inbox = await admin
    .from("inbox_items")
    .insert({
      org_id: event.orgId,
      client_id: event.clientId,
      audit_id: auditId,
      message_id: event.id,
      priority: plan.inbox.priority,
      emergency: plan.inbox.emergency,
      reason_codes: plan.inbox.reasonCodes,
      title: plan.inbox.title,
    })
    .select("id")
    .single();
  if (inbox.error || !inbox.data) throw new Error(inbox.error?.message ?? "inbox insert failed");
  const inboxId = text(inbox.data.id);

  if (plan.holdDraft) {
    const draft = await admin.from("held_drafts").insert({
      org_id: event.orgId,
      client_id: event.clientId,
      thread_id: event.threadId,
      message_id: event.id,
      audit_id: auditId,
      inbox_item_id: inboxId,
      draft_text: plan.holdDraft.draftText,
      sources: plan.holdDraft.sources,
    });
    if (draft.error) throw new Error(draft.error.message);
  }

  if (plan.notice) {
    const notice = await admin.from("trainer_notices").insert({
      org_id: event.orgId,
      client_id: event.clientId,
      inbox_item_id: inboxId,
      title: plan.notice.title,
      body: plan.notice.body,
      emergency: plan.notice.emergency,
    });
    if (notice.error) throw new Error(notice.error.message);
  }
}

/** Runs after a client message is stored. Failures stay on the server. The client message remains. */
export async function runClientAi(event: ClientMessageEvent): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  const prior = await admin.from("audit_events").select("id").eq("message_id", event.id).maybeSingle();
  if (prior.data) return;
  const runtime = createAiRuntime();
  const settingsRow = await admin
    .from("ai_settings")
    .select("org_id, auto_send, threshold, sign_off, tone_notes")
    .eq("org_id", event.orgId)
    .maybeSingle();
  const settings = parseAiSettings(settingsRow.data) ?? {
    orgId: event.orgId,
    ...DEFAULT_AI_SETTINGS,
  };
  const plan = await gateClientMessage({
    message: event.body,
    messageId: event.id,
    orgId: event.orgId,
    clientId: event.clientId,
    threadId: event.threadId,
    settings: {
      autoSend: settings.autoSend,
      threshold: settings.threshold,
      signOff: settings.signOff,
      toneNotes: settings.toneNotes,
    },
    chat: runtime.chat,
    now: new Date().toISOString(),
    loadChunks: async () => {
      await ensureProgramChunks(admin, runtime.embedder, event.orgId, event.clientId);
      return retrieve(
        { orgId: event.orgId, clientId: event.clientId, message: event.body, k: 5 },
        {
          embedder: runtime.embedder,
          store: {
            async search(input) {
              const { data, error } = await admin.rpc("match_chunks", {
                query_embedding: toVectorLiteral(input.embedding),
                target_org: input.orgId,
                target_client: input.clientId,
                match_count: input.k,
              });
              if (error) throw new Error(error.message);
              return mapMatch(data);
            },
          },
        },
      );
    },
  });
  await commitPlan(admin, event, plan);
}
