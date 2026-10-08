import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogQueue, type LogQueue } from "./log-queue";
import type { LogOperation } from "./log";

const EXERCISE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_KEY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function operation(): LogOperation {
  return {
    clientKey: CLIENT_KEY,
    kind: "save_sets",
    exerciseId: EXERCISE_ID,
    scheduledOn: "2026-10-08",
    sets: [{ index: 1, weightKg: 43.1, reps: 8 }],
    note: "",
    markDone: true,
  };
}

function memoryStore() {
  let raw: unknown = [];
  return {
    read: async () => raw,
    write: async (items: LogOperation[]) => {
      raw = JSON.parse(JSON.stringify(items)) as unknown;
    },
  };
}

function server() {
  const rows: LogOperation[] = [];
  let calls = 0;
  return {
    rows,
    calls: () => calls,
    apply: async (next: LogOperation) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (rows.some((row) => row.clientKey === next.clientKey)) return;
      rows.push(next);
    },
  };
}

function queue(store: ReturnType<typeof memoryStore>, online: () => Promise<boolean>): LogQueue {
  return createLogQueue({ read: store.read, write: store.write, online });
}

test("a set queued offline syncs once after a restart while online", async () => {
  const store = memoryStore();
  let online = false;
  const offline = queue(store, async () => online);
  await offline.enqueue(operation());
  const held = await offline.flush(async () => {
    throw new Error("flush while offline should not apply");
  });
  assert.equal(held.flushed, 0);
  assert.equal(held.pending, 1);
  assert.equal((await offline.read()).length, 1);

  online = true;
  const restarted = queue(store, async () => online);
  const db = server();
  const synced = await restarted.flush(db.apply);
  assert.equal(synced.flushed, 1);
  assert.equal(synced.pending, 0);
  assert.equal(db.calls(), 1);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0]?.clientKey, CLIENT_KEY);

  const replay = await restarted.flush(db.apply);
  assert.equal(replay.flushed, 0);
  assert.equal(db.calls(), 1);
  assert.equal(db.rows.length, 1);
});

test("a foreground trigger and a network trigger flush once", async () => {
  const store = memoryStore();
  const active = queue(store, async () => true);
  await active.enqueue(operation());
  const db = server();
  const [foreground, network] = await Promise.all([active.flush(db.apply), active.flush(db.apply)]);
  assert.equal(foreground.flushed, 1);
  assert.equal(network.flushed, 1);
  assert.equal(db.calls(), 1);
  assert.equal(db.rows.length, 1);
  assert.equal(new Set(db.rows.map((row) => row.clientKey)).size, 1);

  const again = await active.flush(db.apply);
  assert.equal(again.flushed, 0);
  assert.equal(db.calls(), 1);
  assert.equal(db.rows.length, 1);
});

const KEY1 = "11111111-1111-4111-8111-111111111111";
const KEY2 = "22222222-2222-4222-8222-222222222222";

function reproOp(clientKey: string): LogOperation {
  return {
    clientKey,
    kind: "save_sets",
    exerciseId: EXERCISE_ID,
    scheduledOn: "2026-10-08",
    sets: [{ index: 1, weightKg: 40, reps: 8 }],
    note: "",
    markDone: false,
  };
}

test("sentinel repro: enqueue during a successful flush is not lost", async () => {
  let raw: unknown = [];
  const q = createLogQueue({
    read: async () => raw,
    write: async (items) => {
      raw = JSON.parse(JSON.stringify(items)) as unknown;
    },
    online: async () => true,
  });
  await q.enqueue(reproOp(KEY1));
  const applied: string[] = [];
  const flushed = q.flush(async (operation) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    applied.push(operation.clientKey);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await q.enqueue(reproOp(KEY2));
  await flushed;

  const queued = (await q.read()).map((item) => item.clientKey);
  const count = (key: string, list: string[]) => list.filter((item) => item === key).length;
  assert.equal(count(KEY1, applied), 1);
  assert.equal(count(KEY1, queued), 0);
  const key2Applied = count(KEY2, applied);
  const key2Queued = count(KEY2, queued);
  assert.equal(key2Applied === 1 || key2Queued === 1, true);
  assert.equal(key2Applied + key2Queued, 1);
});

test("sentinel repro: enqueue during a network error stays with the failed set", async () => {
  let raw: unknown = [];
  const q = createLogQueue({
    read: async () => raw,
    write: async (items) => {
      raw = JSON.parse(JSON.stringify(items)) as unknown;
    },
    online: async () => true,
  });
  await q.enqueue(reproOp(KEY1));
  const flushed = q.flush(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new TypeError("Network request failed");
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await q.enqueue(reproOp(KEY2));
  await flushed;

  const queued = (await q.read()).map((item) => item.clientKey);
  assert.deepEqual(queued, [KEY1, KEY2]);
});
