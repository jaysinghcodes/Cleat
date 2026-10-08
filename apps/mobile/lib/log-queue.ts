import { isOfflineError, logOperationSchema, type LogOperation } from "@cleat/domain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const QUEUE_KEY = "cleat-log-queue";

let flushing = false;

export async function deviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

export function watchOnline(onOnline: () => void): { remove: () => void } {
  const subscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) onOnline();
  });
  return { remove: () => subscription.remove() };
}

export async function readLogQueue(): Promise<LogOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const result = logOperationSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export async function writeLogQueue(items: LogOperation[]): Promise<void> {
  if (items.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueLog(operation: LogOperation): Promise<void> {
  const current = await readLogQueue();
  current.push(operation);
  await writeLogQueue(current);
}

export async function flushLogQueue(
  apply: (operation: LogOperation) => Promise<void>,
): Promise<{ flushed: number; pending: number; error: string | null }> {
  if (flushing) {
    const pending = (await readLogQueue()).length;
    return { flushed: 0, pending, error: null };
  }
  flushing = true;
  try {
    if (!(await deviceOnline())) {
      const pending = (await readLogQueue()).length;
      return { flushed: 0, pending, error: null };
    }
    const queue = await readLogQueue();
    let index = 0;
    let error: string | null = null;
    for (; index < queue.length; index += 1) {
      const operation = queue[index];
      if (!operation) break;
      try {
        await apply(operation);
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
    await writeLogQueue(remaining);
    return { flushed: index - (error ? 1 : 0), pending: remaining.length, error };
  } finally {
    flushing = false;
  }
}
