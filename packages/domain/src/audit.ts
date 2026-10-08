import * as z from "zod";

export const AUDIT_DECISIONS = ["auto_send", "escalate", "hard_refuse"] as const;

export const AUDIT_TEMPLATES = ["emergency", "emergency_self_harm", "medical_safety"] as const;

export const TRAINER_ACTIONS = ["send_edited", "send_as_is", "dismiss"] as const;

export const auditChunkSchema = z.object({
  id: z.uuid(),
  snippet: z.string(),
  score: z.number(),
});

export const auditEventSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  messageId: z.uuid(),
  chunks: z.array(auditChunkSchema),
  draftText: z.string(),
  confidence: z.number(),
  threshold: z.number(),
  reasonCodes: z.array(z.string()),
  decision: z.enum(AUDIT_DECISIONS),
  templateId: z.enum(AUDIT_TEMPLATES).nullable(),
  deliveredAt: z.string().nullable(),
  trainerEdit: z.boolean().nullable(),
  trainerAction: z.enum(TRAINER_ACTIONS).nullable(),
  finalText: z.string().nullable(),
  model: z.string(),
  promptVersion: z.string(),
  createdAt: z.string(),
  trainerActedAt: z.string().nullable(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export type AuditTimelineItem = {
  at: string;
  label: string;
};

export function auditTimeline(event: AuditEvent): AuditTimelineItem[] {
  const items: AuditTimelineItem[] = [
    { at: event.createdAt, label: "Client message received" },
    { at: event.createdAt, label: "Decision recorded" },
  ];
  if (event.deliveredAt) items.push({ at: event.deliveredAt, label: "Reply delivered" });
  if (event.trainerActedAt && event.trainerAction === "send_edited") {
    items.push({ at: event.trainerActedAt, label: "Trainer sent an edit" });
  } else if (event.trainerActedAt && event.trainerAction === "send_as_is") {
    items.push({ at: event.trainerActedAt, label: "Trainer sent the draft" });
  } else if (event.trainerActedAt && event.trainerAction === "dismiss") {
    items.push({ at: event.trainerActedAt, label: "Trainer dismissed the draft" });
  }
  return items;
}

const auditRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  client_id: z.uuid(),
  message_id: z.uuid(),
  chunks: z.array(auditChunkSchema).nullable().optional(),
  draft_text: z.string(),
  confidence: z.coerce.number(),
  threshold: z.coerce.number(),
  reason_codes: z.array(z.string()).nullable().optional(),
  decision: z.enum(AUDIT_DECISIONS),
  template_id: z.enum(AUDIT_TEMPLATES).nullable(),
  delivered_at: z.string().nullable(),
  trainer_edit: z.boolean().nullable(),
  trainer_action: z.enum(TRAINER_ACTIONS).nullable(),
  final_text: z.string().nullable(),
  model: z.string(),
  prompt_version: z.string(),
  created_at: z.string(),
  trainer_acted_at: z.string().nullable(),
});

export function parseAuditEvent(data: unknown): AuditEvent | null {
  const parsed = auditRowSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    orgId: parsed.data.org_id,
    clientId: parsed.data.client_id,
    messageId: parsed.data.message_id,
    chunks: parsed.data.chunks ?? [],
    draftText: parsed.data.draft_text,
    confidence: parsed.data.confidence,
    threshold: parsed.data.threshold,
    reasonCodes: parsed.data.reason_codes ?? [],
    decision: parsed.data.decision,
    templateId: parsed.data.template_id,
    deliveredAt: parsed.data.delivered_at,
    trainerEdit: parsed.data.trainer_edit,
    trainerAction: parsed.data.trainer_action,
    finalText: parsed.data.final_text,
    model: parsed.data.model,
    promptVersion: parsed.data.prompt_version,
    createdAt: parsed.data.created_at,
    trainerActedAt: parsed.data.trainer_acted_at,
  };
}

export function parseAuditEvents(data: unknown): AuditEvent[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = parseAuditEvent(row);
    return parsed ? [parsed] : [];
  });
}

export function auditCounts(events: AuditEvent[], now = Date.now()): {
  autoSent: number;
  escalated: number;
  hardRefuse: number;
  trainerEdited: number;
} {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recent = events.filter((event) => {
    const acted = event.trainerActedAt ? Date.parse(event.trainerActedAt) : Number.NaN;
    const created = Date.parse(event.createdAt);
    return (Number.isFinite(created) && created >= cutoff) || (Number.isFinite(acted) && acted >= cutoff);
  });
  return {
    autoSent: recent.filter((event) => event.decision === "auto_send").length,
    escalated: recent.filter((event) => event.decision === "escalate").length,
    hardRefuse: recent.filter((event) => event.decision === "hard_refuse").length,
    trainerEdited: recent.filter((event) => event.trainerAction === "send_edited").length,
  };
}
