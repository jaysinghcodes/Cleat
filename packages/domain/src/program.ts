import * as z from "zod";
import { firstName } from "./auth";
import { formatWeight, type WeightUnit } from "./log";

export const NUDGE_GAP_DAYS = 3;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function bounded(max: number, message: string) {
  return z.string().trim().refine((value) => value.length >= 1 && value.length <= max, message);
}

export const exerciseDraftSchema = z.object({
  name: bounded(80, "Enter an exercise name."),
  sets: z
    .number()
    .int()
    .refine((value) => value >= 1 && value <= 20, "Sets must be between 1 and 20."),
  reps: bounded(40, "Enter the reps."),
  notes: z.string().max(280, "Keep notes under 280 characters."),
  videoUrl: z
    .string()
    .max(300, "Enter a video link that starts with https.")
    .refine(
      (value) => value.trim() === "" || /^https?:\/\//i.test(value.trim()),
      "Enter a video link that starts with https.",
    ),
});

export type ExerciseDraft = z.infer<typeof exerciseDraftSchema>;

export const dayDraftSchema = z.object({
  name: bounded(80, "Enter a day name."),
  rest: z.boolean(),
  exercises: z.array(exerciseDraftSchema),
});

export type DayDraft = z.infer<typeof dayDraftSchema>;

export const programDraftSchema = z.object({
  clientId: z.uuid(),
  name: bounded(80, "Enter a program name."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a start date."),
  days: z.array(dayDraftSchema).refine((days) => days.length >= 1 && days.length <= 14, "Add between 1 and 14 days."),
});

export type ProgramDraft = z.infer<typeof programDraftSchema>;

export function programDraftMessage(input: ProgramDraft): string | null {
  const parsed = programDraftSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Enter a program name.";
  for (const day of parsed.data.days) {
    if (!day.rest && day.exercises.length < 1) return "Add an exercise to each training day.";
  }
  return null;
}

export type ProgramExercise = {
  id: string;
  position: number;
  name: string;
  sets: number;
  reps: string;
  notes: string;
  videoUrl: string | null;
};

export type ProgramDay = {
  id: string;
  position: number;
  name: string;
  rest: boolean;
  exercises: ProgramExercise[];
};

export type AssignedProgram = {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  startDate: string;
  days: ProgramDay[];
};

/** Stub row kept for earlier imports. Assignment uses AssignedProgram. */
export const programSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  clientId: z.uuid(),
  name: z.string(),
  startDate: z.string(),
});

export type Program = z.infer<typeof programSchema>;

export type TodayStatus = "done" | "partial" | "skipped" | "missed" | "rest" | "none";

export type NudgeReason = "missed_yesterday" | "skipped_flagged" | "no_log_3_days";

export type BoardAction = "message" | "soft" | "send";

export type BoardWorkout = {
  clientId: string;
  programId: string;
  scheduledOn: string;
  status: "partial" | "done" | "skipped" | "missed";
  flagged: boolean;
  skipNote: string | null;
};

export type BoardExerciseLog = {
  clientId: string;
  exerciseId: string;
  scheduledOn: string;
  status: "partial" | "done";
};

export type BoardSet = {
  clientId: string;
  exerciseId: string;
  scheduledOn: string;
  setIndex: number;
  weightKg: number;
  reps: number;
};

export type BoardClient = {
  userId: string;
  displayName: string;
  weightUnit: WeightUnit;
  joinedOn: string;
};

export type BoardRow = {
  userId: string;
  displayName: string;
  weightUnit: WeightUnit;
  today: TodayStatus;
  todayLabel: string;
  summary: string;
  adherence: string;
  lastLogged: string;
  reasons: NudgeReason[];
  needsNudge: boolean;
  action: BoardAction;
  urgency: number;
};

export type BoardCounts = {
  done: number;
  skipped: number;
  needsNudge: number;
};

export function calendarDate(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // An unknown timezone falls back to UTC.
  }
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string): number {
  const [y1, m1, d1] = earlier.split("-").map(Number);
  const [y2, m2, d2] = later.split("-").map(Number);
  const start = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  const end = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((end - start) / 86_400_000);
}

export function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return WEEKDAYS[date.getUTCDay()] ?? "";
}

export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const monthName = MONTHS[date.getUTCMonth()] ?? "";
  return `${weekdayLabel(iso)} ${monthName} ${date.getUTCDate()}`;
}

export function weekDates(today: string): string[] {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addDays(today, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function programDayForDate<T>(program: { startDate: string; days: T[] }, date: string): T | null {
  if (program.days.length === 0) return null;
  const delta = daysBetween(program.startDate, date);
  if (delta < 0) return null;
  return program.days[delta % program.days.length] ?? null;
}

export function prescription(exercise: { sets: number; reps: string; notes: string }): string {
  const base = `${exercise.sets} × ${exercise.reps}`;
  const notes = exercise.notes.trim();
  return notes ? `${base} · ${notes}` : base;
}

export function progressLabel(logged: number, total: number): string {
  return `${logged} of ${total} exercises logged`;
}

export function progressPercent(logged: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((logged / total) * 100);
}

export function adherenceLabel(done: number, scheduled: number): string {
  if (scheduled <= 0) return "No sessions this week";
  return `${done} of ${scheduled} done this week`;
}

export function lastLoggedLabel(days: number | null): string {
  if (days === null) return "No logs yet";
  if (days <= 0) return "Last logged today";
  if (days === 1) return "Last logged 1 day ago";
  return `Last logged ${days} days ago`;
}

export function nudgeBody(kind: "soft" | "nudge", coachName: string): string {
  const coach = firstName(coachName);
  if (kind === "soft") return `${coach} sent a soft nudge. Log today when you can.`;
  return `${coach} sent a nudge. Open today and log your sets.`;
}

export function todayStatusLabel(status: TodayStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "partial":
      return "Partial";
    case "skipped":
      return "Skipped";
    case "missed":
      return "Missed";
    case "rest":
      return "Rest";
    default:
      return "No program";
  }
}

export function exerciseIsLogged(
  exercise: { id: string; sets: number },
  logs: BoardExerciseLog[],
  sets: BoardSet[],
  clientId: string,
  date: string,
): boolean {
  const log = logs.find(
    (row) => row.clientId === clientId && row.exerciseId === exercise.id && row.scheduledOn === date,
  );
  if (log?.status === "done") return true;
  const filled = new Set(
    sets
      .filter(
        (row) =>
          row.clientId === clientId &&
          row.exerciseId === exercise.id &&
          row.scheduledOn === date &&
          row.reps >= 1,
      )
      .map((row) => row.setIndex),
  );
  if (exercise.sets < 1) return false;
  for (let index = 1; index <= exercise.sets; index += 1) {
    if (!filled.has(index)) return false;
  }
  return true;
}

export function loggedExerciseCount(
  day: ProgramDay,
  logs: BoardExerciseLog[],
  sets: BoardSet[],
  clientId: string,
  date: string,
): number {
  return day.exercises.filter((exercise) => exerciseIsLogged(exercise, logs, sets, clientId, date)).length;
}

type StatusInput = {
  clientId: string;
  date: string;
  program: AssignedProgram | null;
  workouts: BoardWorkout[];
  exerciseLogs: BoardExerciseLog[];
  sets: BoardSet[];
};

export function dayStatus(input: StatusInput): TodayStatus {
  const { clientId, date, program, workouts, exerciseLogs, sets } = input;
  const workout = workouts.find((row) => row.clientId === clientId && row.scheduledOn === date);
  const sameProgram = Boolean(workout && program && workout.programId === program.id);

  if (!program) {
    if (workout?.status === "done") return "done";
    if (workout?.status === "partial") return "partial";
    if (workout?.status === "skipped") return "skipped";
    return "none";
  }

  const day = programDayForDate(program, date);
  if (!day) return "none";
  if (sameProgram && workout?.status === "skipped") return "skipped";
  if (day.rest && !(sameProgram && (workout?.status === "done" || workout?.status === "partial"))) {
    return "rest";
  }
  if (day.rest) return "rest";

  const logged = loggedExerciseCount(day, exerciseLogs, sets, clientId, date);
  const total = day.exercises.length;
  if (total > 0 && logged >= total) return "done";
  if (sameProgram && workout?.status === "done") return "done";
  const anyWork =
    logged > 0 ||
    (sameProgram && workout?.status === "partial") ||
    exerciseLogs.some((row) => row.clientId === clientId && row.scheduledOn === date && day.exercises.some((exercise) => exercise.id === row.exerciseId)) ||
    sets.some((row) => row.clientId === clientId && row.scheduledOn === date && day.exercises.some((exercise) => exercise.id === row.exerciseId));
  if (anyWork) return "partial";
  return "missed";
}

function latestDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return dates.slice().sort().at(-1) ?? null;
}

function activityDates(clientId: string, workouts: BoardWorkout[]): string[] {
  return workouts
    .filter(
      (row) =>
        row.clientId === clientId &&
        (row.status === "done" || row.status === "partial" || row.status === "skipped") &&
        row.scheduledOn,
    )
    .map((row) => row.scheduledOn);
}

export function nudgeReasons(input: {
  today: string;
  client: BoardClient;
  program: AssignedProgram | null;
  workouts: BoardWorkout[];
  exerciseLogs: BoardExerciseLog[];
  sets: BoardSet[];
}): NudgeReason[] {
  const reasons: NudgeReason[] = [];
  const yesterday = addDays(input.today, -1);
  const prior = input.workouts.find(
    (row) => row.clientId === input.client.userId && row.scheduledOn === yesterday,
  );
  const yesterdayHandled = Boolean(prior && prior.status !== "missed");
  if (!yesterdayHandled) {
    const status = dayStatus({
      clientId: input.client.userId,
      date: yesterday,
      program: input.program,
      workouts: input.workouts,
      exerciseLogs: input.exerciseLogs,
      sets: input.sets,
    });
    if (status === "missed") reasons.push("missed_yesterday");
  }

  const dates = activityDates(input.client.userId, input.workouts);
  const latestActivity = latestDate(dates);
  const latestSkip = latestDate(
    input.workouts
      .filter((row) => row.clientId === input.client.userId && row.status === "skipped" && row.flagged)
      .map((row) => row.scheduledOn),
  );
  if (latestSkip && latestSkip >= (latestActivity ?? latestSkip)) reasons.push("skipped_flagged");

  const anchor = latestActivity ?? input.program?.startDate ?? input.client.joinedOn;
  const since = daysBetween(anchor, input.today);
  if (since >= NUDGE_GAP_DAYS) reasons.push("no_log_3_days");

  return reasons;
}

function boardAction(reasons: NudgeReason[]): BoardAction {
  if (reasons.includes("missed_yesterday") || reasons.includes("no_log_3_days")) return "send";
  if (reasons.includes("skipped_flagged")) return "soft";
  return "message";
}

function urgency(reasons: NudgeReason[], today: TodayStatus): number {
  if (reasons.includes("missed_yesterday")) return 0;
  if (reasons.includes("skipped_flagged")) return 1;
  if (reasons.includes("no_log_3_days")) return 2;
  if (today === "missed") return 3;
  if (today === "partial") return 4;
  if (today === "skipped") return 5;
  if (today === "done") return 6;
  return 7;
}

function summaryFor(input: {
  status: TodayStatus;
  program: AssignedProgram | null;
  today: string;
  client: BoardClient;
  workouts: BoardWorkout[];
  exerciseLogs: BoardExerciseLog[];
  sets: BoardSet[];
}): string {
  const { status, program, today, client } = input;
  if (!program) return "No program assigned";
  if (daysBetween(program.startDate, today) < 0) return `Starts ${shortDate(program.startDate)}`;
  const day = programDayForDate(program, today);
  if (!day || status === "rest") return "Rest day";
  if (status === "none") return "No program assigned";
  if (status === "skipped") {
    const workout = input.workouts.find(
      (row) => row.clientId === client.userId && row.scheduledOn === today && row.status === "skipped",
    );
    const note = workout?.skipNote?.trim();
    return note ? `${day.name} · marked skip · ${note}` : `${day.name} · marked skip`;
  }
  if (status === "missed") return `${day.name} · no log yet`;
  const logged = loggedExerciseCount(day, input.exerciseLogs, input.sets, client.userId, today);
  if (status === "partial") return `${day.name} · ${progressLabel(logged, day.exercises.length)}`;
  const loggedSet = input.sets
    .filter((row) => row.clientId === client.userId && row.scheduledOn === today)
    .sort((a, b) => a.setIndex - b.setIndex)
    .at(-1);
  const exercise = day.exercises.find((item) => item.id === loggedSet?.exerciseId) ?? day.exercises[0];
  if (loggedSet && exercise) {
    return `${day.name} · ${exercise.name} ${formatWeight(loggedSet.weightKg, client.weightUnit)} ${client.weightUnit}`;
  }
  return `${day.name} · ${progressLabel(logged, day.exercises.length)}`;
}

export function buildAccountability(input: {
  today: string;
  clients: BoardClient[];
  programs: AssignedProgram[];
  workouts: BoardWorkout[];
  exerciseLogs: BoardExerciseLog[];
  sets: BoardSet[];
}): { rows: BoardRow[]; counts: BoardCounts } {
  const rows = input.clients.map((client) => {
    const program = input.programs.find((item) => item.clientId === client.userId) ?? null;
    const status = dayStatus({
      clientId: client.userId,
      date: input.today,
      program,
      workouts: input.workouts,
      exerciseLogs: input.exerciseLogs,
      sets: input.sets,
    });
    const reasons = nudgeReasons({
      today: input.today,
      client,
      program,
      workouts: input.workouts,
      exerciseLogs: input.exerciseLogs,
      sets: input.sets,
    });
    const dates = activityDates(client.userId, input.workouts).filter((date) => daysBetween(date, input.today) >= 0);
    const last = latestDate(dates);
    const week = weekDates(input.today).filter((date) => daysBetween(date, input.today) >= 0);
    let scheduled = 0;
    let done = 0;
    for (const date of week) {
      const day = dayStatus({
        clientId: client.userId,
        date,
        program,
        workouts: input.workouts,
        exerciseLogs: input.exerciseLogs,
        sets: input.sets,
      });
      if (day === "done" || day === "partial" || day === "skipped" || day === "missed") {
        scheduled += 1;
        if (day === "done") done += 1;
      }
    }
    return {
      userId: client.userId,
      displayName: client.displayName,
      weightUnit: client.weightUnit,
      today: status,
      todayLabel: todayStatusLabel(status),
      summary: summaryFor({
        status,
        program,
        today: input.today,
        client,
        workouts: input.workouts,
        exerciseLogs: input.exerciseLogs,
        sets: input.sets,
      }),
      adherence: adherenceLabel(done, scheduled),
      lastLogged: lastLoggedLabel(last === null ? null : daysBetween(last, input.today)),
      reasons,
      needsNudge: reasons.length > 0,
      action: boardAction(reasons),
      urgency: urgency(reasons, status),
    };
  });

  rows.sort((a, b) => a.urgency - b.urgency || a.displayName.localeCompare(b.displayName));

  return {
    rows,
    counts: {
      done: rows.filter((row) => row.today === "done").length,
      skipped: rows.filter((row) => row.today === "skipped").length,
      needsNudge: rows.filter((row) => row.needsNudge).length,
    },
  };
}

const programRowSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  client_id: z.uuid(),
  name: z.string(),
  start_date: z.string(),
  status: z.enum(["active", "replaced"]),
});

const dayRowSchema = z.object({
  id: z.uuid(),
  program_id: z.uuid(),
  position: z.number().int(),
  name: z.string(),
  is_rest: z.boolean(),
});

const exerciseRowSchema = z.object({
  id: z.uuid(),
  day_id: z.uuid(),
  program_id: z.uuid(),
  position: z.number().int(),
  name: z.string(),
  sets: z.number().int(),
  reps: z.string(),
  notes: z.string(),
  video_url: z.string().nullable(),
});

function asArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

export function bundlePrograms(programs: unknown, days: unknown, exercises: unknown): AssignedProgram[] {
  const programRows = z.array(programRowSchema).safeParse(asArray(programs));
  const dayRows = z.array(dayRowSchema).safeParse(asArray(days));
  const exerciseRows = z.array(exerciseRowSchema).safeParse(asArray(exercises));
  if (!programRows.success || !dayRows.success || !exerciseRows.success) return [];
  return programRows.data
    .filter((program) => program.status === "active")
    .map((program) => ({
      id: program.id,
      orgId: program.org_id,
      clientId: program.client_id,
      name: program.name,
      startDate: program.start_date.slice(0, 10),
      days: dayRows.data
        .filter((day) => day.program_id === program.id)
        .sort((a, b) => a.position - b.position)
        .map((day) => ({
          id: day.id,
          position: day.position,
          name: day.name,
          rest: day.is_rest,
          exercises: exerciseRows.data
            .filter((exercise) => exercise.day_id === day.id)
            .sort((a, b) => a.position - b.position)
            .map((exercise) => ({
              id: exercise.id,
              position: exercise.position,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              notes: exercise.notes,
              videoUrl: exercise.video_url,
            })),
        })),
    }));
}

export const programCopy = {
  emptyClients: "No clients yet. Invite a client from Clients, then build their week here.",
  emptyBoard: "No clients yet. Invite a client from Clients. The board fills in once they are on the roster.",
  emptyToday: "No program yet. Your coach will assign one.",
  emptyProgram: "No program yet. Your coach will assign one.",
  assignReplaces: "Assign replaces the current week.",
  nudgeRule: "Missed yesterday, a skipped workout, or no log in 3 days.",
  doneHint: "Logged today's session",
  skippedHint: "Marked skip today",
  savedOffline: "Saved on this phone. It will sync when you are back online.",
  synced: "Log synced.",
  restToday: "Rest day. Nothing to log.",
  skipConfirm: "Skip today",
  couldNotAssign: "Could not assign the program.",
  couldNotLog: "Could not save the log.",
  couldNotNudge: "Could not send the nudge.",
} as const;
