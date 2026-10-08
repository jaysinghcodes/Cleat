import {
  CleatRequestError,
  applyClientLog,
  dismissNudge,
  fetchClientTraining,
  updateWeightUnit,
  type ClientTraining,
} from "@cleat/api";
import { copy, isOfflineError, programCopy, type LogOperation, type WeightUnit } from "@cleat/domain";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useSession } from "./session";
import { deviceOnline, enqueueLog, flushLogQueue, readLogQueue, watchOnline } from "./log-queue";

type TrainingContextValue = {
  ready: boolean;
  training: ClientTraining | null;
  pendingCount: number;
  error: string | null;
  notice: string | null;
  refresh: () => Promise<void>;
  saveOperation: (operation: LogOperation) => Promise<boolean>;
  setUnit: (unit: WeightUnit) => Promise<void>;
  dismiss: (nudgeId: string) => Promise<void>;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

function overlay(base: ClientTraining, queue: LogOperation[], userId: string): ClientTraining {
  const workouts = base.workouts.map((row) => ({ ...row }));
  const exerciseLogs = base.exerciseLogs.map((row) => ({ ...row }));
  const sets = base.sets.map((row) => ({ ...row }));
  for (const operation of queue) {
    if (operation.kind === "skip_day") {
      const index = workouts.findIndex((row) => row.scheduledOn === operation.scheduledOn);
      const next = {
        clientId: userId,
        programId: base.program?.id ?? "",
        scheduledOn: operation.scheduledOn,
        status: "skipped" as const,
        flagged: true,
        skipNote: operation.note.trim() ? operation.note.trim() : null,
      };
      if (index >= 0) workouts[index] = next;
      else workouts.push(next);
    }
    if (operation.kind === "save_sets" && operation.exerciseId) {
      const exerciseId = operation.exerciseId;
      for (let index = sets.length - 1; index >= 0; index -= 1) {
        const row = sets[index];
        if (row && row.exerciseId === exerciseId && row.scheduledOn === operation.scheduledOn) {
          sets.splice(index, 1);
        }
      }
      for (const set of operation.sets ?? []) {
        sets.push({
          clientId: userId,
          exerciseId,
          scheduledOn: operation.scheduledOn,
          setIndex: set.index,
          weightKg: set.weightKg,
          reps: set.reps,
        });
      }
      const status = operation.markDone ? "done" : "partial";
      const logIndex = exerciseLogs.findIndex(
        (row) => row.exerciseId === exerciseId && row.scheduledOn === operation.scheduledOn,
      );
      const log = {
        clientId: userId,
        exerciseId,
        scheduledOn: operation.scheduledOn,
        status: status as "done" | "partial",
      };
      if (logIndex >= 0) exerciseLogs[logIndex] = log;
      else exerciseLogs.push(log);
      const workoutIndex = workouts.findIndex((row) => row.scheduledOn === operation.scheduledOn);
      const workout = {
        clientId: userId,
        programId: base.program?.id ?? "",
        scheduledOn: operation.scheduledOn,
        status: "partial" as const,
        flagged: false,
        skipNote: null,
      };
      if (workoutIndex >= 0 && workouts[workoutIndex]?.status !== "done") workouts[workoutIndex] = workout;
      else if (workoutIndex < 0) workouts.push(workout);
    }
  }
  return { ...base, workouts, exerciseLogs, sets };
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { client, session } = useSession();
  const [base, setBase] = useState<ClientTraining | null>(null);
  const [queue, setQueue] = useState<LogOperation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !session) return;
    const [next, pending] = await Promise.all([
      fetchClientTraining(client, session.userId),
      readLogQueue(),
    ]);
    setBase(next);
    setQueue(pending);
    setReady(true);
  }, [client, session]);

  const flush = useCallback(async () => {
    if (!client || !session) return;
    const result = await flushLogQueue((operation) => applyClientLog(client, operation));
    if (result.error) setError(result.error);
    if (result.flushed > 0) {
      setNotice(programCopy.synced);
      await refresh();
      return;
    }
    setQueue(await readLogQueue());
  }, [client, session, refresh]);

  useEffect(() => {
    if (!client || !session) return;
    let alive = true;
    void (async () => {
      try {
        await refresh();
      } catch (err: unknown) {
        if (!alive) return;
        setError(err instanceof CleatRequestError ? err.message : copy.generic);
        setReady(true);
      }
      if (!alive) return;
      await flush();
    })();
    const watcher = watchOnline(() => {
      void flush();
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void flush();
    });
    return () => {
      alive = false;
      watcher.remove();
      appState.remove();
    };
  }, [client, session, refresh, flush]);

  const saveOperation = useCallback(
    async (operation: LogOperation) => {
      if (!client) return false;
      setError(null);
      const online = await deviceOnline();
      if (!online) {
        await enqueueLog(operation);
        setQueue(await readLogQueue());
        setNotice(programCopy.savedOffline);
        return true;
      }
      try {
        await applyClientLog(client, operation);
        setNotice(null);
        await refresh();
        return true;
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueueLog(operation);
          setQueue(await readLogQueue());
          setNotice(programCopy.savedOffline);
          return true;
        }
        setNotice(null);
        setError(err instanceof CleatRequestError ? err.message : copy.generic);
        return false;
      }
    },
    [client, refresh],
  );

  const setUnit = useCallback(
    async (unit: WeightUnit) => {
      if (!client || !session) return;
      setError(null);
      try {
        await updateWeightUnit(client, session.userId, unit);
        await refresh();
      } catch (err) {
        setError(err instanceof CleatRequestError ? err.message : copy.generic);
      }
    },
    [client, session, refresh],
  );

  const dismiss = useCallback(
    async (nudgeId: string) => {
      if (!client) return;
      try {
        await dismissNudge(client, nudgeId);
        await refresh();
      } catch (err) {
        setError(err instanceof CleatRequestError ? err.message : copy.generic);
      }
    },
    [client, refresh],
  );

  const training = useMemo(() => {
    if (!base || !session) return base;
    return overlay(base, queue, session.userId);
  }, [base, queue, session]);

  const value = useMemo<TrainingContextValue>(
    () => ({
      ready,
      training,
      pendingCount: queue.length,
      error,
      notice,
      refresh,
      saveOperation,
      setUnit,
      dismiss,
    }),
    [ready, training, queue.length, error, notice, refresh, saveOperation, setUnit, dismiss],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const value = useContext(TrainingContext);
  if (!value) throw new Error("useTraining must be used within TrainingProvider");
  return value;
}
