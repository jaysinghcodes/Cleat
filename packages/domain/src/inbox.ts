import * as z from "zod";

export const inboxItemSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  auditId: z.uuid(),
  messageId: z.uuid(),
  priority: z.enum(["p0", "p1"]),
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
