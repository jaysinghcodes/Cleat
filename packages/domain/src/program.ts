import * as z from "zod";

/** Stub. Ticket 2 adds days, exercises, sets, and assignment. */
export const programSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
});

export type Program = z.infer<typeof programSchema>;
