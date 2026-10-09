import * as z from "zod";
import type { BoardRow, NudgeReason } from "./program";
import { addDays } from "./program";

export const INBOX_PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export type InboxPriority = (typeof INBOX_PRIORITIES)[number];

export const INBOX_REASONS = ["emergency", "injury", "ai_escalate", "unanswered", "missed"] as const;
export type InboxReason = (typeof INBOX_REASONS)[number];

export const DEFAULT_UNANSWERED_HOURS = 4;
export const MIN_UNANSWERED_HOURS = 1;
export const MAX_UNANSWERED_HOURS = 168;

export const inboxCopy = {
  title: "Priority inbox",
  lede: "Who needs you now. Oldest first in each tier.",
  empty: "Nothing needs you right now.",
  filterEmpty: "Nothing in this filter.",
  all: "All",
  emergency: "Emergency",
  injury: "Injury",
  aiEscalate: "AI escalate",
  unanswered: "Unanswered",
  missed: "Missed",
  review: "Review",
  editDraft: "Edit draft",
  nudge: "Nudge",
  openInbox: "Open inbox",
  clientMessage: "Client message",
  templateSent: "Sent to the client",
  templateEmergency: "Emergency",
  templateSelfHarm: "Emergency and the 988 line",
  templateMedical: "Medical safety",
  noDraft: "No held draft. The safety reply was already sent.",
  reply: "Reply",
  replyLabel: "Your reply",
  sendReply: "Send reply",
  dismiss: "Dismiss",
  why: "Why this was held",
  confidence: "Confidence",
  threshold: "Threshold",
  sources: "Sources",
  draft: "Held draft",
  audit: "Audit log",
  notices: "Notices",
  windowLabel: "Unanswered window",
  windowHint: "Hours before an unanswered client message shows in the inbox. The default is 4.",
  windowInvalid: "Enter a window from 1 to 168 hours.",
  signIn: "Sign in before replying.",
  emptyReply: "Write a reply first.",
  notOpen: "That inbox item is not open.",
  useDraft: "Use the draft actions for this item.",
  badTier: "Choose an inbox tier.",
  nudgeSent: "Nudge sent.",
  replySent: "Reply sent.",
  dismissed: "Dismissed.",
  draftSent: "Sent.",
  justNow: "Just now",
} as const;

const REASON_LABEL: Record<InboxReason, string> = {
  emergency: inboxCopy.emergency,
  injury: inboxCopy.injury,
  ai_escalate: inboxCopy.aiEscalate,
  unanswered: inboxCopy.unanswered,
  missed: inboxCopy.missed,
};

const WHY_LABEL: Record<string, string> = {
  retrieval_gap: "Not enough in your notes",
  ambiguous: "The match was not clear",
  refusal_keyword: "Injury or medical wording",
  emergency: "Emergency wording",
  self_harm: "Self harm wording",
  asks_for_coach: "They asked for you",
  program_swap: "They asked to change programs",
  auto_send_off: "Auto send is off",
  unanswered: "No reply yet",
  missed: "Missed workout or needs a nudge",
};

export function inboxReasonLabel(reason: InboxReason): string {
  return REASON_LABEL[reason];
}

export function whyEscalated(reasonCodes: string[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const code of reasonCodes) {
    const line = WHY_LABEL[code];
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

export function templateLabel(templateId: string | null): string | null {
  if (templateId === "emergency_self_harm") return inboxCopy.templateSelfHarm;
  if (templateId === "emergency") return inboxCopy.templateEmergency;
  if (templateId === "medical_safety") return inboxCopy.templateMedical;
  return null;
}

/** Null when the value is outside 1 to 168. The stored default is 4. */
export function parseUnansweredHours(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isInteger(numeric)) return null;
  if (numeric < MIN_UNANSWERED_HOURS || numeric > MAX_UNANSWERED_HOURS) return null;
  return numeric;
}

export function unansweredHoursOrDefault(value: unknown): number {
  return parseUnansweredHours(value) ?? DEFAULT_UNANSWERED_HOURS;
}

export function isPastUnansweredWindow(messageAt: string, now: string, hours: number): boolean {
  const sent = Date.parse(messageAt);
  const current = Date.parse(now);
  if (Number.isNaN(sent) || Number.isNaN(current)) return false;
  return current - sent >= hours * 60 * 60 * 1000;
}

export function inboxAge(createdAt: string, now: string): string {
  const sent = Date.parse(createdAt);
  const current = Date.parse(now);
  if (Number.isNaN(sent) || Number.isNaN(current)) return inboxCopy.justNow;
  const minutes = Math.max(0, Math.floor((current - sent) / 60000));
  if (minutes < 1) return inboxCopy.justNow;
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export type InboxSource = {
  title: string;
  articleId: string | null;
};

export type InboxDraftView = {
  id: string;
  text: string;
  sources: InboxSource[];
};

export type InboxQueueItem = {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  priority: InboxPriority;
  emergency: boolean;
  reason: InboxReason;
  reasonCodes: string[];
  title: string;
  preview: string;
  createdAt: string;
  auditId: string | null;
  messageId: string | null;
  templateId: "emergency" | "emergency_self_harm" | "medical_safety" | null;
  confidence: number | null;
  threshold: number | null;
  draft: InboxDraftView | null;
  why: string[];
  derived: boolean;
  nudgeKind: "soft" | "nudge" | null;
};

export type StoredInboxItem = {
  id: string;
  orgId: string;
  clientId: string;
  auditId: string | null;
  messageId: string | null;
  priority: InboxPriority;
  emergency: boolean;
  reasonCodes: string[];
  title: string;
  preview: string;
  templateId: InboxQueueItem["templateId"];
  status: "open" | "sent" | "dismissed";
  createdAt: string;
};

export type InboxAuditSlice = {
  id: string;
  confidence: number;
  threshold: number;
  templateId: InboxQueueItem["templateId"];
  reasonCodes: string[];
};

export type InboxDraftSlice = {
  id: string;
  inboxItemId: string;
  text: string;
  sources: InboxSource[];
  status: "held" | "sent" | "dismissed";
};

export type ThreadHead = {
  threadId: string;
  clientId: string;
  messageId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

const templateSchema = z.enum(["emergency", "emergency_self_harm", "medical_safety"]).nullable();

const storedRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  client_id: z.uuid(),
  audit_id: z.uuid().nullable(),
  message_id: z.uuid().nullable(),
  priority: z.enum(INBOX_PRIORITIES),
  emergency: z.boolean(),
  reason_codes: z.array(z.string()),
  title: z.string(),
  preview: z.string().optional(),
  template_id: templateSchema.optional(),
  status: z.enum(["open", "sent", "dismissed"]),
  created_at: z.string(),
});

export function parseStoredInboxItems(data: unknown): StoredInboxItem[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = storedRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        orgId: parsed.data.org_id,
        clientId: parsed.data.client_id,
        auditId: parsed.data.audit_id,
        messageId: parsed.data.message_id,
        priority: parsed.data.priority,
        emergency: parsed.data.emergency,
        reasonCodes: parsed.data.reason_codes,
        title: parsed.data.title,
        preview: parsed.data.preview ?? "",
        templateId: parsed.data.template_id ?? null,
        status: parsed.data.status,
        createdAt: parsed.data.created_at,
      },
    ];
  });
}

const headRowSchema = z.object({
  thread_id: z.uuid(),
  client_id: z.uuid(),
  message_id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
});

export function parseThreadHeads(data: unknown): ThreadHead[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = headRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        threadId: parsed.data.thread_id,
        clientId: parsed.data.client_id,
        messageId: parsed.data.message_id,
        senderId: parsed.data.sender_id,
        body: parsed.data.body,
        createdAt: parsed.data.created_at,
      },
    ];
  });
}

export function inboxReason(item: {
  priority: InboxPriority;
  emergency: boolean;
  reasonCodes?: string[];
}): InboxReason {
  const codes = item.reasonCodes ?? [];
  if (item.emergency || codes.includes("emergency") || codes.includes("self_harm")) return "emergency";
  if (item.priority === "p0") return "injury";
  if (item.priority === "p1") return "ai_escalate";
  if (item.priority === "p2") return "unanswered";
  return "missed";
}

function tierRank(item: { priority: InboxPriority; emergency: boolean; reasonCodes?: string[] }): number {
  if (item.priority === "p0" && inboxReason(item) === "emergency") return 0;
  if (item.priority === "p0") return 1;
  if (item.priority === "p1") return 2;
  if (item.priority === "p2") return 3;
  return 4;
}

export function sortInboxItems<T extends { priority: InboxPriority; emergency: boolean; reasonCodes?: string[]; createdAt: string; id: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const rank = tierRank(a) - tierRank(b);
    if (rank !== 0) return rank;
    const time = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (!Number.isNaN(time) && time !== 0) return time;
    return a.id.localeCompare(b.id);
  });
}

export function inboxReasonCounts(items: { reason: InboxReason }[]): Record<InboxReason, number> {
  const counts: Record<InboxReason, number> = {
    emergency: 0,
    injury: 0,
    ai_escalate: 0,
    unanswered: 0,
    missed: 0,
  };
  for (const item of items) counts[item.reason] += 1;
  return counts;
}

export function filterInbox<T extends { reason: InboxReason }>(items: T[], reason: InboxReason | "all"): T[] {
  if (reason === "all") return items;
  return items.filter((item) => item.reason === reason);
}

export function inboxHref(input: { itemId?: string; clientId?: string; focus?: InboxReason }): string {
  const params = new URLSearchParams();
  if (input.itemId) params.set("item", input.itemId);
  if (input.clientId) params.set("client", input.clientId);
  if (input.focus) params.set("focus", input.focus);
  const query = params.toString();
  return query ? `/inbox?${query}` : "/inbox";
}

export function selectInboxItem(
  items: InboxQueueItem[],
  query: { item?: string | null; client?: string | null; focus?: string | null },
): InboxQueueItem | null {
  if (query.item) return items.find((item) => item.id === query.item) ?? null;
  const focus = INBOX_REASONS.find((reason) => reason === query.focus) ?? null;
  if (query.client && focus) {
    return (
      items.find((item) => item.clientId === query.client && item.reason === focus) ??
      items.find((item) => item.clientId === query.client) ??
      null
    );
  }
  if (query.client) return items.find((item) => item.clientId === query.client) ?? null;
  return null;
}

export function missedInboxId(clientId: string): string {
  return `missed:${clientId}`;
}

export function unansweredInboxId(messageId: string): string {
  return `unanswered:${messageId}`;
}

function missedOccurredAt(today: string, reasons: NudgeReason[]): string {
  const date = reasons.includes("missed_yesterday") ? addDays(today, -1) : today;
  return `${date}T00:00:00.000Z`;
}

export function missedCandidates(rows: BoardRow[], today: string): {
  clientId: string;
  displayName: string;
  summary: string;
  occurredAt: string;
  nudgeKind: "soft" | "nudge";
}[] {
  return rows
    .filter((row) => row.needsNudge)
    .map((row) => ({
      clientId: row.userId,
      displayName: row.displayName,
      summary: row.summary,
      occurredAt: missedOccurredAt(today, row.reasons),
      nudgeKind: row.action === "soft" ? "soft" : "nudge",
    }));
}

const sourceSchema = z.object({
  title: z.string(),
  articleId: z.string().nullable(),
});

function parseSources(data: unknown): InboxSource[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = sourceSchema.safeParse(item);
    if (!parsed.success || !parsed.data.title.trim()) return [];
    return [{ title: parsed.data.title.trim(), articleId: parsed.data.articleId }];
  });
}

export function buildInboxQueue(input: {
  orgId: string;
  now: string;
  windowHours: number;
  names: Record<string, string>;
  stored: StoredInboxItem[];
  drafts: InboxDraftSlice[];
  audits: InboxAuditSlice[];
  heads: ThreadHead[];
  missed: { clientId: string; displayName: string; summary: string; occurredAt: string; nudgeKind: "soft" | "nudge" }[];
}): InboxQueueItem[] {
  const hours = unansweredHoursOrDefault(input.windowHours);
  const audits = new Map(input.audits.map((audit) => [audit.id, audit]));
  const drafts = new Map(
    input.drafts.filter((draft) => draft.status === "held").map((draft) => [draft.inboxItemId, draft]),
  );
  const coveredMessages = new Set(input.stored.flatMap((item) => (item.messageId ? [item.messageId] : [])));
  const openP3 = new Set(
    input.stored.filter((item) => item.status === "open" && item.priority === "p3").map((item) => item.clientId),
  );

  const queue: InboxQueueItem[] = input.stored
    .filter((item) => item.status === "open")
    .map((item) => {
      const audit = item.auditId ? audits.get(item.auditId) : undefined;
      const draft = drafts.get(item.id) ?? null;
      const reasonCodes = item.reasonCodes.length > 0 ? item.reasonCodes : (audit?.reasonCodes ?? []);
      const reason = inboxReason({ priority: item.priority, emergency: item.emergency, reasonCodes });
      return {
        id: item.id,
        orgId: item.orgId,
        clientId: item.clientId,
        clientName: input.names[item.clientId] ?? "Client",
        priority: item.priority,
        emergency: reason === "emergency",
        reason,
        reasonCodes,
        title: item.title,
        preview: item.preview,
        createdAt: item.createdAt,
        auditId: item.auditId,
        messageId: item.messageId,
        templateId: item.templateId ?? audit?.templateId ?? null,
        confidence: audit?.confidence ?? null,
        threshold: audit?.threshold ?? null,
        draft: draft
          ? { id: draft.id, text: draft.text, sources: draft.sources }
          : null,
        why: whyEscalated(reasonCodes),
        derived: false,
        nudgeKind: item.priority === "p3" ? "nudge" : null,
      };
    });

  for (const head of input.heads) {
    if (head.senderId !== head.clientId) continue;
    if (coveredMessages.has(head.messageId)) continue;
    if (!isPastUnansweredWindow(head.createdAt, input.now, hours)) continue;
    queue.push({
      id: unansweredInboxId(head.messageId),
      orgId: input.orgId,
      clientId: head.clientId,
      clientName: input.names[head.clientId] ?? "Client",
      priority: "p2",
      emergency: false,
      reason: "unanswered",
      reasonCodes: ["unanswered"],
      title: inboxCopy.unanswered,
      preview: head.body,
      createdAt: head.createdAt,
      auditId: null,
      messageId: head.messageId,
      templateId: null,
      confidence: null,
      threshold: null,
      draft: null,
      why: whyEscalated(["unanswered"]),
      derived: true,
      nudgeKind: null,
    });
  }

  for (const missed of input.missed) {
    if (openP3.has(missed.clientId)) continue;
    queue.push({
      id: missedInboxId(missed.clientId),
      orgId: input.orgId,
      clientId: missed.clientId,
      clientName: missed.displayName || input.names[missed.clientId] || "Client",
      priority: "p3",
      emergency: false,
      reason: "missed",
      reasonCodes: ["missed"],
      title: inboxCopy.missed,
      preview: missed.summary,
      createdAt: missed.occurredAt,
      auditId: null,
      messageId: null,
      templateId: null,
      confidence: null,
      threshold: null,
      draft: null,
      why: whyEscalated(["missed"]),
      derived: true,
      nudgeKind: missed.nudgeKind,
    });
  }

  return sortInboxItems(queue);
}

export function parseDraftSources(data: unknown): InboxSource[] {
  return parseSources(data);
}

const auditSliceSchema = z.object({
  id: z.uuid(),
  confidence: z.coerce.number(),
  threshold: z.coerce.number(),
  template_id: templateSchema.optional(),
  reason_codes: z.array(z.string()).optional(),
});

export function parseInboxAudits(data: unknown): InboxAuditSlice[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = auditSliceSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        confidence: parsed.data.confidence,
        threshold: parsed.data.threshold,
        templateId: parsed.data.template_id ?? null,
        reasonCodes: parsed.data.reason_codes ?? [],
      },
    ];
  });
}

const draftSliceSchema = z.object({
  id: z.uuid(),
  inbox_item_id: z.uuid(),
  draft_text: z.string(),
  sources: z.unknown().optional(),
  status: z.enum(["held", "sent", "dismissed"]),
});

export function parseInboxDrafts(data: unknown): InboxDraftSlice[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = draftSliceSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        inboxItemId: parsed.data.inbox_item_id,
        text: parsed.data.draft_text,
        sources: parseSources(parsed.data.sources),
        status: parsed.data.status,
      },
    ];
  });
}

export const inboxItemSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  auditId: z.uuid().nullable(),
  messageId: z.uuid().nullable(),
  priority: z.enum(INBOX_PRIORITIES),
  emergency: z.boolean(),
  reasonCodes: z.array(z.string()),
  title: z.string(),
  status: z.enum(["open", "sent", "dismissed"]),
  createdAt: z.string(),
});

export type InboxItem = z.infer<typeof inboxItemSchema>;

export const trainerNoticeSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  inboxItemId: z.uuid().nullable(),
  title: z.string(),
  body: z.string(),
  emergency: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type TrainerNotice = z.infer<typeof trainerNoticeSchema>;

const noticeRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  client_id: z.uuid(),
  inbox_item_id: z.uuid().nullable(),
  title: z.string(),
  body: z.string(),
  emergency: z.boolean(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export function parseTrainerNotices(data: unknown): TrainerNotice[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = noticeRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        orgId: parsed.data.org_id,
        clientId: parsed.data.client_id,
        inboxItemId: parsed.data.inbox_item_id,
        title: parsed.data.title,
        body: parsed.data.body,
        emergency: parsed.data.emergency,
        readAt: parsed.data.read_at,
        createdAt: parsed.data.created_at,
      },
    ];
  });
}
