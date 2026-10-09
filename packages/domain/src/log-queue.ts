import { isOfflineError, logOperationSchema, type LogOperation } from "./log";
import { userFacingError } from "./screen-state";
import { programCopy } from "./program";

export type LogFlushResult = {
  flushed: number;
  pending: number;
  error: string | null;
};

export type LogQueue = {
  read: () => Promise<LogOperation[]>;
  enqueue: (operation: LogOperation) => Promise<void>;
  flush: (apply: (operation: LogOperation) => Promise<void>) => Promise<LogFlushResult>;
};

/**
 * Offline log queue. Storage read-modify-writes share one chain, so enqueue
 * and flush cannot overwrite each other. A flush removes entries by clientKey
 * after re-reading storage. One flush runs at a time.
 */
export function createLogQueue(options: {
  read: () => Promise<unknown>;
  write: (items: LogOperation[]) => Promise<void>;
  online: () => Promise<boolean>;
}): LogQueue {
  let inflight: Promise<LogFlushResult> | null = null;
  let storage: Promise<void> = Promise.resolve();

  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = storage.then(work, work);
    storage = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function read(): Promise<LogOperation[]> {
    try {
      const parsed = await options.read();
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        const result = logOperationSchema.safeParse(item);
        return result.success ? [result.data] : [];
      });
    } catch {
      return [];
    }
  }

  async function execute(apply: (operation: LogOperation) => Promise<void>): Promise<LogFlushResult> {
    if (!(await options.online())) {
      const pending = (await read()).length;
      return { flushed: 0, pending, error: null };
    }

    const applied = new Set<string>();
    let error: string | null = null;
    let dropped: string | null = null;

    for (;;) {
      const next = await exclusive(async () => {
        const queue = await read();
        return queue.find((item) => item.clientKey !== dropped && !applied.has(item.clientKey)) ?? null;
      });
      if (!next) break;
      try {
        await apply(next);
        applied.add(next.clientKey);
      } catch (err) {
        if (isOfflineError(err)) {
          error = null;
          break;
        }
        error = userFacingError(err, programCopy.couldNotLog);
        dropped = next.clientKey;
        break;
      }
    }

    const pending = await exclusive(async () => {
      const latest = await read();
      const remaining = latest.filter((item) => item.clientKey !== dropped && !applied.has(item.clientKey));
      await options.write(remaining);
      return remaining.length;
    });

    return { flushed: applied.size, pending, error };
  }

  return {
    read,
    enqueue(operation) {
      return exclusive(async () => {
        const current = await read();
        current.push(operation);
        await options.write(current);
      });
    },
    flush(apply) {
      if (inflight) return inflight;
      const run = execute(apply);
      inflight = run;
      return run.finally(() => {
        if (inflight === run) inflight = null;
      });
    },
  };
}
