import * as z from "zod";

/** Stub. Ticket 4 adds sources, confidence, and the AI decision. */
export const auditEventSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
