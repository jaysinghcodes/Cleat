import { isOfflineError, logOperationSchema, type LogOperation } from "./log";

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
 * Offline log queue. One flush runs at a time. A second trigger joins that
 * run, and a client key is applied at most once per run. The server also
 * ignores a replay of the same client key.
 */
export function createLogQueue(options: {
  read: () => Promise<unknown>;
  write: (items: LogOperation[]) => Promise<void>;
  online: () => Promise<boolean>;
}): LogQueue {
  let inflight: Promise<LogFlushResult> | null = null;

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

  async function write(items: LogOperation[]): Promise<void> {
    await options.write(items);
  }

  async function execute(apply: (operation: LogOperation) => Promise<void>): Promise<LogFlushResult> {
    if (!(await options.online())) {
      const pending = (await read()).length;
      return { flushed: 0, pending, error: null };
    }
    const queue = await read();
    let index = 0;
    let error: string | null = null;
    const applied = new Set<string>();
    for (; index < queue.length; index += 1) {
      const operation = queue[index];
      if (!operation) break;
      if (applied.has(operation.clientKey)) continue;
      try {
        await apply(operation);
        applied.add(operation.clientKey);
      } catch (err) {
        if (isOfflineError(err)) {
          error = null;
          break;
        }
        error = err instanceof Error ? err.message : "Could not save the log.";
        index += 1;
        break;
      }
    }
    const remaining = queue.slice(index);
    await write(remaining);
    return { flushed: index - (error ? 1 : 0), pending: remaining.length, error };
  }

  return {
    read,
    async enqueue(operation) {
      const current = await read();
      current.push(operation);
      await write(current);
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
