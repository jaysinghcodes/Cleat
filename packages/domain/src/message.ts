import * as z from "zod";

/** Stub. Ticket 3 adds the client-trainer thread message. */
export const messageSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
});

export type Message = z.infer<typeof messageSchema>;
