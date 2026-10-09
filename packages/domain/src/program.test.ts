import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adherenceLabel,
  buildAccountability,
  dayStatus,
  lastLoggedLabel,
  nudgeBody,
  nudgeReasons,
  exerciseRowLabel,
  programDayForDate,
  programDraftMessage,
  type AssignedProgram,
  type BoardClient,
  type BoardExerciseLog,
  type BoardSet,
  type BoardWorkout,
} from "./program";

const CLIENT = "22222222-2222-2222-2222-222222222222";
const PROGRAM_ID = "10000000-0000-4000-8000-000000000001";
const DAY_ID = "10000000-0000-4000-8000-000000000002";
const EXERCISE_ID = "10000000-0000-4000-8000-000000000003";

function trainingProgram(startDate: string, days = 1): AssignedProgram {
  return {
    id: PROGRAM_ID,
    orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    clientId: CLIENT,
    name: "Foundation",
    startDate,
    days: Array.from({ length: days }, (_, index) => ({
      id: index === 0 ? DAY_ID : `10000000-0000-4000-8000-00000000000${index + 4}`,
      position: index,
      name: index === 0 ? "Lower A" : `Day ${index + 1}`,
      rest: false,
      exercises: [
        {
          id: index === 0 ? EXERCISE_ID : `10000000-0000-4000-8000-00000000001${index}`,
          position: 0,
          name: "Back squat",
          sets: 3,
          reps: "5",
          notes: "RPE 7",
          videoUrl: null,
        },
      ],
    })),
  };
}

function client(joinedOn = "2026-10-01"): BoardClient {
  return {
    userId: CLIENT,
    displayName: "Sam Lee",
    weightUnit: "lb",
    joinedOn,
  };
}

function workout(scheduledOn: string, status: BoardWorkout["status"], flagged = false): BoardWorkout {
  return {
    clientId: CLIENT,
    programId: PROGRAM_ID,
    scheduledOn,
    status,
    flagged,
    skipNote: status === "skipped" ? "Travel" : null,
  };
}

test("program days cycle from the start date", () => {
  const program = trainingProgram("2026-10-05", 3);
  const day = programDayForDate(program, "2026-10-08");
  assert.equal(day?.name, "Lower A");
  assert.equal(programDayForDate(program, "2026-10-04"), null);
});

test("a blank assign needs a name, a day, and an exercise", () => {
  assert.equal(
    programDraftMessage({
      clientId: "22222222-2222-4222-8222-222222222222",
      name: "",
      startDate: "2026-10-07",
      days: [{ name: "Day 1", rest: false, exercises: [] }],
    }),
    "Enter a program name.",
  );
  assert.equal(
    programDraftMessage({
      clientId: "22222222-2222-4222-8222-222222222222",
      name: "Foundation",
      startDate: "2026-10-07",
      days: [{ name: "Day 1", rest: false, exercises: [] }],
    }),
    "Add an exercise to each training day.",
  );
  assert.equal(
    programDraftMessage({
      clientId: "22222222-2222-4222-8222-222222222222",
      name: "Foundation",
      startDate: "2026-10-07",
      days: [
        {
          name: "Day 1",
          rest: false,
          exercises: [{ name: "Back squat", sets: 3, reps: "5", notes: "", videoUrl: "" }],
        },
      ],
    }),
    null,
  );
});

test("last logged 2 days ago is not an inactivity nudge and 3 days ago is", () => {
  const program = trainingProgram("2026-10-01", 1);
  const base = {
    today: "2026-10-07",
    client: client(),
    program,
    exerciseLogs: [] as BoardExerciseLog[],
    sets: [] as BoardSet[],
  };
  const twoDays = nudgeReasons({ ...base, workouts: [workout("2026-10-05", "done")] });
  const threeDays = nudgeReasons({ ...base, workouts: [workout("2026-10-04", "done")] });
  assert.equal(twoDays.includes("no_log_3_days"), false);
  assert.equal(threeDays.includes("no_log_3_days"), true);
});

test("a rest day yesterday is not missed, and a training day with no log is", () => {
  const today = "2026-10-07";
  const restYesterday = trainingProgram("2026-10-06", 2);
  restYesterday.days[0] = { ...restYesterday.days[0], rest: true, exercises: [] };
  assert.equal(
    nudgeReasons({
      today,
      client: client(),
      program: restYesterday,
      workouts: [],
      exerciseLogs: [],
      sets: [],
    }).includes("missed_yesterday"),
    false,
  );

  const trainYesterday = trainingProgram("2026-10-06", 1);
  assert.equal(
    nudgeReasons({
      today,
      client: client(),
      program: trainYesterday,
      workouts: [],
      exerciseLogs: [],
      sets: [],
    }).includes("missed_yesterday"),
    true,
  );
});

test("a flagged skip needs a nudge until a later log", () => {
  const program = trainingProgram("2026-10-05", 1);
  const skipped = nudgeReasons({
    today: "2026-10-07",
    client: client(),
    program,
    workouts: [workout("2026-10-07", "skipped", true)],
    exerciseLogs: [],
    sets: [],
  });
  assert.equal(skipped.includes("skipped_flagged"), true);

  const resolved = nudgeReasons({
    today: "2026-10-07",
    client: client(),
    program,
    workouts: [workout("2026-10-06", "skipped", true), workout("2026-10-07", "done")],
    exerciseLogs: [],
    sets: [],
  });
  assert.equal(resolved.includes("skipped_flagged"), false);
});

test("adherence counts completed sessions this week and never mentions a streak", () => {
  assert.equal(adherenceLabel(3, 4), "3 of 4 done this week");
  assert.equal(lastLoggedLabel(2), "Last logged 2 days ago");
  assert.equal(lastLoggedLabel(0), "Last logged today");
  assert.equal(`${adherenceLabel(3, 4)} ${lastLoggedLabel(2)}`.toLowerCase().includes("streak"), false);

  const program = trainingProgram("2026-10-05", 1);
  const sets: BoardSet[] = [1, 2, 3].map((index) => ({
    clientId: CLIENT,
    exerciseId: EXERCISE_ID,
    scheduledOn: "2026-10-08",
    setIndex: index,
    weightKg: 61.235,
    reps: 5,
  }));
  const logs: BoardExerciseLog[] = [
    { clientId: CLIENT, exerciseId: EXERCISE_ID, scheduledOn: "2026-10-08", status: "done" },
  ];
  const workouts = [
    workout("2026-10-05", "done"),
    workout("2026-10-06", "done"),
    workout("2026-10-07", "done"),
    workout("2026-10-08", "done"),
  ];
  const board = buildAccountability({
    today: "2026-10-08",
    clients: [client()],
    programs: [program],
    workouts,
    exerciseLogs: logs,
    sets,
  });
  assert.equal(board.rows[0]?.adherence, "4 of 4 done this week");
  assert.equal(board.rows[0]?.today, "done");
  assert.equal(board.rows[0]?.needsNudge, false);
  assert.match(board.rows[0]?.summary ?? "", /135 lb/);
  assert.equal(board.rows[0]?.action, "message");
});

test("the board sorts the client who needs a nudge ahead of a finished client", () => {
  const other = "44444444-4444-4444-4444-444444444444";
  const program = trainingProgram("2026-10-06", 1);
  const otherProgram: AssignedProgram = {
    ...program,
    id: "10000000-0000-4000-8000-000000000099",
    clientId: other,
  };
  const board = buildAccountability({
    today: "2026-10-07",
    clients: [
      { ...client(), displayName: "Sam Lee" },
      {
        userId: other,
        displayName: "Riley Wong",
        weightUnit: "kg",
        joinedOn: "2026-10-01",
      },
    ],
    programs: [program, otherProgram],
    workouts: [
      {
        clientId: other,
        programId: otherProgram.id,
        scheduledOn: "2026-10-06",
        status: "done",
        flagged: false,
        skipNote: null,
      },
      {
        clientId: other,
        programId: otherProgram.id,
        scheduledOn: "2026-10-07",
        status: "done",
        flagged: false,
        skipNote: null,
      },
    ],
    exerciseLogs: [],
    sets: [],
  });
  assert.equal(board.rows[0]?.displayName, "Sam Lee");
  assert.equal(board.rows[0]?.needsNudge, true);
  assert.equal(board.rows[0]?.action, "send");
  assert.equal(board.rows[1]?.todayLabel, "Done");
  assert.equal(board.rows[1]?.needsNudge, false);
  assert.equal(board.counts.needsNudge >= 1, true);
});

test("today exercise row label includes the visible text", () => {
  const label = exerciseRowLabel({ name: "Squat", sets: 3, reps: "5", notes: "" }, "Active");
  assert.equal(label, "Squat 3 × 5 Active");
  assert.equal(label.includes("Squat"), true);
  assert.equal(label.includes("3 × 5"), true);
  assert.equal(label.includes("Active"), true);
});

test("nudge copy names the coach and does not use dash punctuation", () => {
  const body = nudgeBody("nudge", "Alex Rivera");
  assert.equal(body, "Alex sent a nudge. Open Today and catch up on a missed day.");
  assert.equal(body.includes("—") || body.includes("–") || body.includes(" - "), false);
});

test("today with no log on a training day is missed, and a full log is done", () => {
  const program = trainingProgram("2026-10-07", 1);
  assert.equal(
    dayStatus({
      clientId: CLIENT,
      date: "2026-10-07",
      program,
      workouts: [],
      exerciseLogs: [],
      sets: [],
    }),
    "missed",
  );
  assert.equal(
    dayStatus({
      clientId: CLIENT,
      date: "2026-10-07",
      program,
      workouts: [],
      exerciseLogs: [{ clientId: CLIENT, exerciseId: EXERCISE_ID, scheduledOn: "2026-10-07", status: "done" }],
      sets: [],
    }),
    "done",
  );
});
