import {
  buildAccountability,
  bundlePrograms,
  calendarDate,
  logOperationSchema,
  productError,
  programCopy,
  screenCopy,
  programDraftMessage,
  programDraftSchema,
  weightUnitSchema,
  type AssignedProgram,
  type BoardCounts,
  type BoardExerciseLog,
  type BoardRow,
  type BoardSet,
  type BoardWorkout,
  type LogOperation,
  type ProgramDraft,
  type WeightUnit,
} from "@cleat/domain";
import { CleatRequestError } from "./auth";
import type { CleatClient } from "./supabase";

function fail(message: string | undefined, fallback: string): never {
  throw new CleatRequestError(productError(message, fallback));
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

async function loadProgramGraph(
  supabase: CleatClient,
  programIds: string[],
): Promise<AssignedProgram[]> {
  if (programIds.length === 0) return [];
  const [days, exercises] = await Promise.all([
    supabase
      .from("program_days")
      .select("id, program_id, position, name, is_rest")
      .in("program_id", programIds),
    supabase
      .from("program_exercises")
      .select("id, day_id, program_id, position, name, sets, reps, notes, video_url")
      .in("program_id", programIds),
  ]);
  if (days.error) fail(days.error.message, programCopy.couldNotAssign);
  if (exercises.error) fail(exercises.error.message, programCopy.couldNotAssign);
  const programs = await supabase
    .from("programs")
    .select("id, org_id, client_id, name, start_date, status")
    .in("id", programIds);
  if (programs.error) fail(programs.error.message, programCopy.couldNotAssign);
  return bundlePrograms(programs.data, days.data, exercises.data);
}

export async function assignProgram(supabase: CleatClient, draft: ProgramDraft): Promise<string> {
  const message = programDraftMessage(draft);
  if (message) throw new CleatRequestError(message);
  const parsed = programDraftSchema.parse(draft);
  const payload = {
    clientId: parsed.clientId,
    name: parsed.name,
    startDate: parsed.startDate,
    days: parsed.days.map((day) => ({
      name: day.name,
      rest: day.rest,
      exercises: day.rest
        ? []
        : day.exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            notes: exercise.notes.trim(),
            videoUrl: exercise.videoUrl.trim(),
          })),
    })),
  };
  const { data, error } = await supabase.rpc("assign_program", { payload });
  if (error) fail(error.message, programCopy.couldNotAssign);
  if (typeof data !== "string") throw new CleatRequestError(programCopy.couldNotAssign);
  return data;
}

export async function fetchActiveProgram(
  supabase: CleatClient,
  clientId: string,
): Promise<AssignedProgram | null> {
  const programs = await supabase
    .from("programs")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active");
  if (programs.error) fail(programs.error.message, programCopy.couldNotAssign);
  const ids = asRows(programs.data).map((row) => String(row.id));
  const bundled = await loadProgramGraph(supabase, ids);
  return bundled[0] ?? null;
}

export async function fetchMyProgram(supabase: CleatClient): Promise<AssignedProgram | null> {
  const programs = await supabase.from("programs").select("id").eq("status", "active");
  if (programs.error) fail(programs.error.message, screenCopy.loadFailed);
  const ids = asRows(programs.data).map((row) => String(row.id));
  const bundled = await loadProgramGraph(supabase, ids);
  return bundled[0] ?? null;
}

export type ClientTraining = {
  program: AssignedProgram | null;
  workouts: BoardWorkout[];
  exerciseLogs: BoardExerciseLog[];
  sets: BoardSet[];
  weightUnit: WeightUnit;
  nudge: { id: string; body: string } | null;
};

export async function fetchClientTraining(
  supabase: CleatClient,
  userId: string,
): Promise<ClientTraining> {
  const [program, profile, workouts, exerciseLogs, nudges] = await Promise.all([
    fetchMyProgram(supabase),
    supabase.from("profiles").select("weight_unit").eq("id", userId).maybeSingle(),
    supabase
      .from("workout_logs")
      .select("client_id, program_id, scheduled_on, status, flagged, skip_note"),
    supabase.from("exercise_logs").select("id, client_id, exercise_id, scheduled_on, status"),
    supabase
      .from("nudge_events")
      .select("id, body, dismissed_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (profile.error) fail(profile.error.message, screenCopy.loadFailed);
  if (workouts.error) fail(workouts.error.message, screenCopy.loadFailed);
  if (exerciseLogs.error) fail(exerciseLogs.error.message, screenCopy.loadFailed);
  if (nudges.error) fail(nudges.error.message, screenCopy.loadFailed);

  const logRows = asRows(exerciseLogs.data);
  const logIds = logRows.map((row) => String(row.id));
  let setRows: Record<string, unknown>[] = [];
  if (logIds.length > 0) {
    const sets = await supabase
      .from("set_logs")
      .select("exercise_log_id, set_index, weight_kg, reps")
      .in("exercise_log_id", logIds);
    if (sets.error) fail(sets.error.message, screenCopy.loadFailed);
    setRows = asRows(sets.data);
  }

  const logsById = new Map(logRows.map((row) => [String(row.id), row]));
  const unit = weightUnitSchema.safeParse(
    profile.data && typeof profile.data === "object" ? (profile.data as { weight_unit?: string }).weight_unit : "lb",
  );

  const nudgeRow = asRows(nudges.data)[0];
  return {
    program,
    weightUnit: unit.success ? unit.data : "lb",
    workouts: asRows(workouts.data).map((row) => ({
      clientId: String(row.client_id),
      programId: String(row.program_id),
      scheduledOn: String(row.scheduled_on).slice(0, 10),
      status: row.status as BoardWorkout["status"],
      flagged: Boolean(row.flagged),
      skipNote: row.skip_note ? String(row.skip_note) : null,
    })),
    exerciseLogs: logRows.map((row) => ({
      clientId: String(row.client_id),
      exerciseId: String(row.exercise_id),
      scheduledOn: String(row.scheduled_on).slice(0, 10),
      status: row.status as BoardExerciseLog["status"],
    })),
    sets: setRows.flatMap((row) => {
      const parent = logsById.get(String(row.exercise_log_id));
      if (!parent) return [];
      return [
        {
          clientId: String(parent.client_id),
          exerciseId: String(parent.exercise_id),
          scheduledOn: String(parent.scheduled_on).slice(0, 10),
          setIndex: Number(row.set_index),
          weightKg: Number(row.weight_kg),
          reps: Number(row.reps),
        },
      ];
    }),
    nudge: nudgeRow ? { id: String(nudgeRow.id), body: String(nudgeRow.body) } : null,
  };
}

export async function applyClientLog(supabase: CleatClient, operation: LogOperation): Promise<void> {
  const parsed = logOperationSchema.parse(operation);
  const { error } = await supabase.rpc("apply_client_log", { payload: parsed });
  if (error) fail(error.message, programCopy.couldNotLog);
}

export async function updateWeightUnit(
  supabase: CleatClient,
  userId: string,
  unit: WeightUnit,
): Promise<void> {
  const parsed = weightUnitSchema.parse(unit);
  const { error } = await supabase.from("profiles").update({ weight_unit: parsed }).eq("id", userId);
  if (error) fail(error.message, programCopy.couldNotLog);
}

export async function dismissNudge(supabase: CleatClient, nudgeId: string): Promise<void> {
  const { error } = await supabase.rpc("dismiss_nudge", { nudge_id: nudgeId });
  if (error) fail(error.message, programCopy.couldNotLog);
}

export async function sendNudge(
  supabase: CleatClient,
  clientId: string,
  kind: "soft" | "nudge",
  body: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("send_nudge", {
    target_client: clientId,
    nudge_kind: kind,
    body,
  });
  if (error) fail(error.message, programCopy.couldNotNudge);
  if (typeof data !== "string") throw new CleatRequestError(programCopy.couldNotNudge);
  return data;
}

export type AccountabilitySnapshot = {
  rows: BoardRow[];
  counts: BoardCounts;
};

export async function fetchAccountability(
  supabase: CleatClient,
  timeZone: string,
): Promise<AccountabilitySnapshot> {
  const today = calendarDate(timeZone);
  const [members, profiles, programs] = await Promise.all([
    supabase.from("memberships").select("user_id, created_at").eq("role", "client"),
    supabase.from("profiles").select("id, display_name, weight_unit"),
    supabase.from("programs").select("id, org_id, client_id, name, start_date, status").eq("status", "active"),
  ]);
  if (members.error) fail(members.error.message, programCopy.couldNotNudge);
  if (profiles.error) fail(profiles.error.message, programCopy.couldNotNudge);
  if (programs.error) fail(programs.error.message, programCopy.couldNotNudge);

  const programIds = asRows(programs.data).map((row) => String(row.id));
  const [days, exercises, workouts, exerciseLogs] = await Promise.all([
    programIds.length
      ? supabase.from("program_days").select("id, program_id, position, name, is_rest").in("program_id", programIds)
      : Promise.resolve({ data: [], error: null }),
    programIds.length
      ? supabase
          .from("program_exercises")
          .select("id, day_id, program_id, position, name, sets, reps, notes, video_url")
          .in("program_id", programIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("workout_logs").select("client_id, program_id, scheduled_on, status, flagged, skip_note"),
    supabase.from("exercise_logs").select("id, client_id, exercise_id, scheduled_on, status"),
  ]);
  if (days.error) fail(days.error.message, programCopy.couldNotNudge);
  if (exercises.error) fail(exercises.error.message, programCopy.couldNotNudge);
  if (workouts.error) fail(workouts.error.message, programCopy.couldNotNudge);
  if (exerciseLogs.error) fail(exerciseLogs.error.message, programCopy.couldNotNudge);

  const logRows = asRows(exerciseLogs.data);
  const logIds = logRows.map((row) => String(row.id));
  let setRows: Record<string, unknown>[] = [];
  if (logIds.length > 0) {
    const sets = await supabase
      .from("set_logs")
      .select("exercise_log_id, set_index, weight_kg, reps")
      .in("exercise_log_id", logIds);
    if (sets.error) fail(sets.error.message, programCopy.couldNotNudge);
    setRows = asRows(sets.data);
  }
  const logsById = new Map(logRows.map((row) => [String(row.id), row]));
  const names = new Map(
    asRows(profiles.data).map((row) => [
      String(row.id),
      {
        displayName: String(row.display_name ?? "Client"),
        weightUnit: weightUnitSchema.safeParse(row.weight_unit).success
          ? weightUnitSchema.parse(row.weight_unit)
          : ("lb" as const),
      },
    ]),
  );

  const bundled = bundlePrograms(programs.data, days.data, exercises.data);
  const built = buildAccountability({
    today,
    clients: asRows(members.data).map((row) => {
      const profile = names.get(String(row.user_id));
      return {
        userId: String(row.user_id),
        displayName: profile?.displayName ?? "Client",
        weightUnit: profile?.weightUnit ?? "lb",
        joinedOn: calendarDate(timeZone, new Date(String(row.created_at))),
      };
    }),
    programs: bundled,
    workouts: asRows(workouts.data).map((row) => ({
      clientId: String(row.client_id),
      programId: String(row.program_id),
      scheduledOn: String(row.scheduled_on).slice(0, 10),
      status: row.status as BoardWorkout["status"],
      flagged: Boolean(row.flagged),
      skipNote: row.skip_note ? String(row.skip_note) : null,
    })),
    exerciseLogs: logRows.map((row) => ({
      clientId: String(row.client_id),
      exerciseId: String(row.exercise_id),
      scheduledOn: String(row.scheduled_on).slice(0, 10),
      status: row.status as BoardExerciseLog["status"],
    })),
    sets: setRows.flatMap((row) => {
      const parent = logsById.get(String(row.exercise_log_id));
      if (!parent) return [];
      return [
        {
          clientId: String(parent.client_id),
          exerciseId: String(parent.exercise_id),
          scheduledOn: String(parent.scheduled_on).slice(0, 10),
          setIndex: Number(row.set_index),
          weightKg: Number(row.weight_kg),
          reps: Number(row.reps),
        },
      ];
    }),
  });
  return built;
}

export async function fetchOrgPrograms(supabase: CleatClient): Promise<AssignedProgram[]> {
  const programs = await supabase
    .from("programs")
    .select("id")
    .eq("status", "active");
  if (programs.error) fail(programs.error.message, programCopy.couldNotAssign);
  return loadProgramGraph(
    supabase,
    asRows(programs.data).map((row) => String(row.id)),
  );
}
