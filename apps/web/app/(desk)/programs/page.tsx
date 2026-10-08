"use client";

import { CleatRequestError, assignProgram, fetchOrgPrograms, listClients } from "@cleat/api";
import {
  calendarDate,
  copy,
  initials,
  programCopy,
  programDraftMessage,
  type AssignedProgram,
  type ClientRosterItem,
  type ExerciseDraft,
  type ProgramDraft,
} from "@cleat/domain";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../session";
import { Banner } from "../../ui";

type ExerciseForm = ExerciseDraft & { key: string };
type DayForm = { key: string; name: string; rest: boolean; exercises: ExerciseForm[] };
type FormState = { name: string; startDate: string; days: DayForm[] };

function newKey(): string {
  return crypto.randomUUID();
}

function blankExercise(): ExerciseForm {
  return { key: newKey(), name: "", sets: 3, reps: "8", notes: "", videoUrl: "" };
}

function blankDay(index: number): DayForm {
  return { key: newKey(), name: `Day ${index}`, rest: false, exercises: [blankExercise()] };
}

function blankForm(startDate: string): FormState {
  return { name: "", startDate, days: [blankDay(1)] };
}

function formFromProgram(program: AssignedProgram): FormState {
  return {
    name: program.name,
    startDate: program.startDate,
    days: program.days.map((day) => ({
      key: day.id,
      name: day.name,
      rest: day.rest,
      exercises:
        day.exercises.length > 0
          ? day.exercises.map((exercise) => ({
              key: exercise.id,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              notes: exercise.notes,
              videoUrl: exercise.videoUrl ?? "",
            }))
          : [blankExercise()],
    })),
  };
}

function toDraft(clientId: string, form: FormState): ProgramDraft {
  return {
    clientId,
    name: form.name,
    startDate: form.startDate,
    days: form.days.map((day) => ({
      name: day.name,
      rest: day.rest,
      exercises: day.rest
        ? []
        : day.exercises.map((exercise) => ({
            name: exercise.name,
            sets: Number(exercise.sets),
            reps: exercise.reps,
            notes: exercise.notes,
            videoUrl: exercise.videoUrl,
          })),
    })),
  };
}

export default function ProgramsPage() {
  const { client, membership } = useSession();
  const [clients, setClients] = useState<ClientRosterItem[]>([]);
  const [programs, setPrograms] = useState<AssignedProgram[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const [roster, assigned] = await Promise.all([listClients(client), fetchOrgPrograms(client)]);
    setClients(roster);
    setPrograms(assigned);
    setReady(true);
    return { roster, assigned };
  }, [client]);

  useEffect(() => {
    if (!client || !membership) return;
    let alive = true;
    void load()
      .then((result) => {
        if (!alive || !result) return;
        const first = result.roster[0];
        if (!first) return;
        setSelectedId((current) => current ?? first.userId);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof CleatRequestError ? err.message : copy.generic);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [client, membership, load]);

  useEffect(() => {
    if (!selectedId || !membership) return;
    const assigned = programs.find((program) => program.clientId === selectedId);
    setForm(assigned ? formFromProgram(assigned) : blankForm(calendarDate(membership.timezone)));
    setDayIndex(0);
  }, [selectedId, programs, membership]);

  const selected = clients.find((person) => person.userId === selectedId) ?? null;
  const currentProgram = programs.find((program) => program.clientId === selectedId) ?? null;
  const day = form?.days[dayIndex] ?? null;

  function updateDay(patch: Partial<DayForm>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        days: current.days.map((item, index) => (index === dayIndex ? { ...item, ...patch } : item)),
      };
    });
  }

  function updateExercise(key: string, patch: Partial<ExerciseForm>) {
    if (!day) return;
    updateDay({
      exercises: day.exercises.map((exercise) => (exercise.key === key ? { ...exercise, ...patch } : exercise)),
    });
  }

  async function onAssign() {
    if (!client || !selected || !form) return;
    const draft = toDraft(selected.userId, form);
    const message = programDraftMessage(draft);
    if (message) {
      setNotice(null);
      setError(message);
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await assignProgram(client, draft);
      setNotice(`Assigned to ${selected.displayName}.`);
      await load();
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <div className="page-head">
        <div>
          <h1>Programs</h1>
          <p>Loading programs</p>
        </div>
      </div>
    );
  }

  if (clients.length === 0 || !form) {
    return (
      <div data-testid="programs-page">
        <div className="page-head">
          <div>
            <h1>Programs</h1>
            <p>Build days, then assign them to one client.</p>
          </div>
        </div>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div className="card" data-testid="programs-empty">
          <div className="name">No clients yet</div>
          <p className="meta">{programCopy.emptyClients}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="programs-page">
      <div className="page-head">
        <div>
          <h1>Programs</h1>
          <p>Build days, then assign them to one client.</p>
        </div>
        {selected ? (
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setNotice(null);
                setError(null);
                setForm(blankForm(calendarDate(membership?.timezone ?? "UTC")));
                setDayIndex(0);
              }}
            >
              New blank
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="assign-program"
              disabled={pending}
              onClick={() => void onAssign()}
            >
              {pending ? "Assigning" : `Assign to ${selected.displayName}`}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      {clients.length === 0 ? (
        <div className="card" data-testid="programs-empty">
          <div className="name">No clients yet</div>
          <p className="meta">{programCopy.emptyClients}</p>
        </div>
      ) : (
        <div className="program-cols">
          <div className="stack">
            <div className="card">
              <div className="kicker">CLIENT</div>
              <div className="stack">
                {clients.map((person) => {
                  const assigned = programs.find((program) => program.clientId === person.userId);
                  const active = person.userId === selectedId;
                  return (
                    <button
                      key={person.userId}
                      type="button"
                      className={active ? "client-pick is-current" : "client-pick"}
                      onClick={() => {
                        setSelectedId(person.userId);
                        setNotice(null);
                        setError(null);
                      }}
                    >
                      <div className="avatar">{initials(person.displayName)}</div>
                      <div>
                        <div className="name">{person.displayName}</div>
                        <div className="meta">
                          {assigned ? `Currently · ${assigned.name}` : "No program assigned"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <div className="kicker">PROGRAM</div>
              <div className="compact-field">
                <label htmlFor="program-name">Name</label>
                <input
                  id="program-name"
                  data-testid="program-name"
                  value={form.name}
                  placeholder="Name this program"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
            </div>
            <div className="card">
              <div className="kicker">START DATE</div>
              <div className="compact-field">
                <label htmlFor="start-date">First day</label>
                <input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </div>
              <p className="meta" style={{ marginTop: 8 }}>
                The client sees Today from this date.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <div className="name">
                  {day ? `Day ${dayIndex + 1} · ${day.name || "Untitled"}` : "Day"}
                </div>
                <div className="meta">Edit exercises, sets, notes, and an optional video link.</div>
              </div>
              <div className="spacer" />
              {form.days.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={index === dayIndex ? "btn btn-ghost btn-sm is-current" : "btn btn-ghost btn-sm"}
                  onClick={() => setDayIndex(index)}
                >
                  Day {index + 1}
                </button>
              ))}
            </div>
            {day ? (
              <div className="stack">
                <div className="field-inline">
                  <div className="compact-field">
                    <label htmlFor="day-name">Day name</label>
                    <input
                      id="day-name"
                      value={day.name}
                      onChange={(event) => updateDay({ name: event.target.value })}
                    />
                  </div>
                  <div className="compact-field">
                    <label htmlFor="day-kind">Kind</label>
                    <button
                      id="day-kind"
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => updateDay({ rest: !day.rest })}
                    >
                      {day.rest ? "Rest day" : "Training day"}
                    </button>
                  </div>
                </div>
                {day.rest ? (
                  <p className="meta">Rest day. Nothing to log.</p>
                ) : (
                  day.exercises.map((exercise, index) => (
                    <div className="exercise" key={exercise.key}>
                      <div className="row">
                        <div className="ord">{index + 1}</div>
                        <div className="name" style={{ fontSize: 13 }}>
                          {exercise.name || "New exercise"}
                        </div>
                        <div className="spacer" />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            updateDay({ exercises: day.exercises.filter((item) => item.key !== exercise.key) })
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <div className="compact-field">
                        <label htmlFor={`ex-name-${exercise.key}`}>Exercise</label>
                        <input
                          id={`ex-name-${exercise.key}`}
                          value={exercise.name}
                          onChange={(event) => updateExercise(exercise.key, { name: event.target.value })}
                        />
                      </div>
                      <div className="field-inline">
                        <div className="compact-field">
                          <label htmlFor={`ex-sets-${exercise.key}`}>Sets</label>
                          <input
                            id={`ex-sets-${exercise.key}`}
                            inputMode="numeric"
                            value={String(exercise.sets)}
                            onChange={(event) =>
                              updateExercise(exercise.key, { sets: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })
                            }
                          />
                        </div>
                        <div className="compact-field">
                          <label htmlFor={`ex-reps-${exercise.key}`}>Reps</label>
                          <input
                            id={`ex-reps-${exercise.key}`}
                            value={exercise.reps}
                            onChange={(event) => updateExercise(exercise.key, { reps: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="compact-field">
                        <label htmlFor={`ex-notes-${exercise.key}`}>Note</label>
                        <input
                          id={`ex-notes-${exercise.key}`}
                          value={exercise.notes}
                          placeholder="RPE, rest, or a cue"
                          onChange={(event) => updateExercise(exercise.key, { notes: event.target.value })}
                        />
                      </div>
                      <div className="compact-field">
                        <label htmlFor={`ex-video-${exercise.key}`}>Video link</label>
                        <input
                          id={`ex-video-${exercise.key}`}
                          value={exercise.videoUrl}
                          placeholder="https://"
                          onChange={(event) => updateExercise(exercise.key, { videoUrl: event.target.value })}
                        />
                      </div>
                    </div>
                  ))
                )}
                <div className="row" style={{ marginTop: 8 }}>
                  {day.rest ? null : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => updateDay({ exercises: [...day.exercises, blankExercise()] })}
                    >
                      Add exercise
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (form.days.length >= 14) return;
                      const next = [...form.days, blankDay(form.days.length + 1)];
                      setForm({ ...form, days: next });
                      setDayIndex(next.length - 1);
                    }}
                  >
                    Add day
                  </button>
                  {form.days.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const next = form.days.filter((_, index) => index !== dayIndex);
                        setForm({ ...form, days: next });
                        setDayIndex(Math.max(0, dayIndex - 1));
                      }}
                    >
                      Remove day
                    </button>
                  ) : null}
                  <div className="spacer" />
                  <span className="meta">
                    {currentProgram
                      ? `Assign replaces ${selected?.displayName ?? "the client"}'s current week.`
                      : programCopy.assignReplaces}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
