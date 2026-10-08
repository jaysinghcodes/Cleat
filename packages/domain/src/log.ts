import * as z from "zod";

/** Pounds to kilograms. 135 lb stores as 61.235 kg and displays as 61.2 kg. */
export const KG_PER_LB = 0.45359237;

export const weightUnitSchema = z.enum(["lb", "kg"]);

export type WeightUnit = z.infer<typeof weightUnitSchema>;

export function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Canonical storage unit is kilograms, rounded to 3 decimals. */
export function weightToKg(value: number, unit: WeightUnit): number {
  const kg = unit === "kg" ? value : value * KG_PER_LB;
  return roundTo(kg, 3);
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (!Number.isFinite(kg)) return "";
  if (unit === "kg") {
    const shown = roundTo(kg, 1);
    return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
  }
  const pounds = roundTo(kg / KG_PER_LB, 1);
  if (Math.abs(pounds - Math.round(pounds)) < 0.05) return String(Math.round(pounds));
  return pounds.toFixed(1);
}

export function parseWeight(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value >= 1000) return null;
  return value;
}

const setEntrySchema = z.object({
  index: z.number().int().min(1).max(20),
  weightKg: z.number().min(0).max(999.999),
  reps: z.number().int().min(1).max(999),
});

export type SetEntry = z.infer<typeof setEntrySchema>;

export const logOperationSchema = z.object({
  clientKey: z.uuid(),
  kind: z.enum(["save_sets", "skip_day"]),
  exerciseId: z.uuid().optional(),
  dayId: z.uuid().optional(),
  scheduledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sets: z.array(setEntrySchema).optional(),
  note: z.string().max(280),
  markDone: z.boolean().optional(),
});

export type LogOperation = z.infer<typeof logOperationSchema>;

export function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("network error") ||
    lower.includes("load failed") ||
    lower.includes("offline") ||
    lower.includes("internet")
  );
}

/** Stub kept so Ticket 2 still typechecks a log row. Ticket 2 stores sets on set_logs. */
export const logSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  scheduledOn: z.string(),
});

export type Log = z.infer<typeof logSchema>;
