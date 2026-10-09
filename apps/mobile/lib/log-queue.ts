import { createLogQueue, type LogOperation } from "@cleat/domain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const QUEUE_KEY = "cleat-log-queue";

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
  return watchNetwork((online) => {
    if (online) onOnline();
  });
}

export function watchNetwork(onChange: (online: boolean) => void): { remove: () => void } {
  const subscription = Network.addNetworkStateListener((state) => {
    onChange(state.isConnected !== false && state.isInternetReachable !== false);
  });
  return { remove: () => subscription.remove() };
}

const queue = createLogQueue({
  read: async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as unknown;
  },
  write: async (items: LogOperation[]) => {
    if (items.length === 0) {
      await AsyncStorage.removeItem(QUEUE_KEY);
      return;
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  },
  online: deviceOnline,
});

export function readLogQueue(): Promise<LogOperation[]> {
  return queue.read();
}

export function enqueueLog(operation: LogOperation): Promise<void> {
  return queue.enqueue(operation);
}

export function flushLogQueue(
  apply: (operation: LogOperation) => Promise<void>,
): ReturnType<typeof queue.flush> {
  return queue.flush(apply);
}
