import * as z from "zod";

/** Stub. Ticket 2 adds per-set weight, reps, and skip notes. */
export const logSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
});

export type Log = z.infer<typeof logSchema>;
