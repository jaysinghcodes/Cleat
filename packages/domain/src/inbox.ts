import * as z from "zod";

/** Stub. Ticket 5 adds urgency, reason codes, and trainer actions. */
export const inboxItemSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
});

export type InboxItem = z.infer<typeof inboxItemSchema>;
