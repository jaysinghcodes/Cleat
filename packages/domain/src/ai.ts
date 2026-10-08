import * as z from "zod";

/** Ticket 7 inserts the demo org with this id. Auto send is ON only for it. */
export const DEMO_ORG_ID = "d1000000-0000-4000-8000-000000000001";

export const KB_CATEGORIES = ["safety", "faq", "rules"] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export const aiCopy = {
  knowledgeTitle: "Knowledge",
  knowledgeLede: "Articles the AI can cite. Only this org is searched.",
  newArticle: "New article",
  saveArticle: "Save article",
  cancel: "Cancel",
  articleTitle: "Title",
  articleBody: "Body",
  category: "Category",
  categorySafety: "Safety",
  categoryFaq: "FAQ",
  categoryRules: "Rules",
  usedIn: "Used in",
  audits: "audits",
  noArticles: "No articles yet. Add one your clients can rely on.",
  pasteHint: "Paste an article into the body.",
  articleSaved: "Article saved.",
  articleFailed: "Could not save that article.",
  settingsTitle: "AI settings",
  settingsLede: "Auto send stays off until you turn it on.",
  saveSettings: "Save",
  settingsSaved: "Settings saved.",
  settingsFailed: "Could not save AI settings.",
  autoSend: "Auto send",
  autoSendOn: "On",
  autoSendOff: "Off",
  autoSendHelp: "High band answers send themselves when this is on. New orgs start off.",
  threshold: "Auto send threshold",
  thresholdHelp: "High is at or above this number. Medium is from the fixed floor 0.50 up to it. Low or refused is below 0.50, or a hard refusal.",
  floorLocked: "Fixed floor 0.50. Not configurable.",
  thresholdRange: "The threshold stays between 0.60 and 0.95.",
  hardRefuse: "Hard refuse",
  hardRefuseHelp: "Locked. These replies are fixed templates.",
  emergencyGroup: "Emergency",
  medicalGroup: "Medical",
  alwaysDraft: "Always escalate as draft",
  voice: "Voice",
  signOff: "Sign off",
  toneNotes: "Tone notes",
  signOffHint: "Added to AI drafts. Never added to a safety template.",
  last7: "Last 7 days",
  statAuto: "Auto sent",
  statEscalated: "Escalated",
  statRefuse: "Hard refuse",
  statEdited: "Trainer edited",
  auditTitle: "Audit log",
  auditLede: "Every AI action, ready to reconstruct.",
  exportJson: "Export JSON",
  allClients: "All clients",
  allDecisions: "All decisions",
  decisionAuto: "Auto send",
  decisionEscalate: "Escalate",
  decisionRefuse: "Hard refuse",
  noAudits: "No AI actions yet.",
  backToAudit: "Back to the audit log",
  confidence: "Confidence",
  thresholdLabel: "Threshold",
  decision: "Decision",
  template: "Template",
  trainerAction: "Trainer action",
  draft: "Draft",
  finalText: "Final text",
  sources: "Sources",
  timeline: "Timeline",
  rawJson: "Raw JSON",
  model: "Model",
  promptVersion: "Prompt version",
  noneYet: "None yet",
  inboxTitle: "Priority inbox",
  inboxLede: "In app notices for AI escalations.",
  noNotices: "No escalations yet.",
  openChat: "Open chat",
  loadFailed: "Could not load that page.",
  emergencyItems: "Chest pain",
  fainting: "Fainting",
  breathing: "Trouble breathing",
  bleeding: "Severe bleeding",
  stroke: "Stroke signs",
  selfHarm: "Self harm",
  injury: "Injury",
  medical: "Medical",
  medication: "Medication",
  nutrition: "Nutrition prescriptions",
  asksCoach: "Asks for the coach",
  programSwaps: "Program swaps",
  actionSendEdited: "Send edited",
  actionSendAsIs: "Send as is",
  actionDismiss: "Dismiss",
} as const;

export const kbArticleSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  title: z.string(),
  category: z.enum(KB_CATEGORIES),
  body: z.string(),
  updatedAt: z.string(),
  usedIn: z.number().int(),
});

export type KbArticle = z.infer<typeof kbArticleSchema>;

export const kbDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(KB_CATEGORIES),
  body: z.string().trim().min(1).max(8000),
});

export type KbDraft = z.infer<typeof kbDraftSchema>;

export const aiSettingsSchema = z.object({
  orgId: z.uuid(),
  autoSend: z.boolean(),
  threshold: z.number().min(0.6).max(0.95),
  signOff: z.string().max(120),
  toneNotes: z.string().max(500),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const DEFAULT_AI_SETTINGS = {
  autoSend: false,
  threshold: 0.85,
  signOff: "",
  toneNotes: "",
} as const;

export function categoryLabel(category: KbCategory): string {
  if (category === "safety") return aiCopy.categorySafety;
  if (category === "rules") return aiCopy.categoryRules;
  return aiCopy.categoryFaq;
}

export function decisionLabel(decision: "auto_send" | "escalate" | "hard_refuse"): string {
  if (decision === "auto_send") return aiCopy.decisionAuto;
  if (decision === "hard_refuse") return aiCopy.decisionRefuse;
  return aiCopy.decisionEscalate;
}

const articleRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  title: z.string(),
  category: z.enum(KB_CATEGORIES),
  body: z.string(),
  updated_at: z.string(),
});

export function parseKbArticles(data: unknown): Omit<KbArticle, "usedIn">[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = articleRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        orgId: parsed.data.org_id,
        title: parsed.data.title,
        category: parsed.data.category,
        body: parsed.data.body,
        updatedAt: parsed.data.updated_at,
      },
    ];
  });
}

const settingsRowSchema = z.object({
  org_id: z.uuid(),
  auto_send: z.boolean(),
  threshold: z.coerce.number(),
  sign_off: z.string(),
  tone_notes: z.string(),
});

export function parseAiSettings(data: unknown): AiSettings | null {
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = settingsRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return {
    orgId: parsed.data.org_id,
    autoSend: parsed.data.auto_send,
    threshold: parsed.data.threshold,
    signOff: parsed.data.sign_off,
    toneNotes: parsed.data.tone_notes,
  };
}

const heldRowSchema = z.object({
  id: z.uuid(),
  inbox_item_id: z.uuid(),
  draft_text: z.string(),
  status: z.enum(["held", "sent", "dismissed"]),
  created_at: z.string(),
});

export type HeldDraftMarker = {
  id: string;
  inboxItemId: string;
  draftText: string;
  status: "held" | "sent" | "dismissed";
  createdAt: string;
};

export function parseHeldDraft(data: unknown): HeldDraftMarker | null {
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = heldRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    inboxItemId: parsed.data.inbox_item_id,
    draftText: parsed.data.draft_text,
    status: parsed.data.status,
    createdAt: parsed.data.created_at,
  };
}
