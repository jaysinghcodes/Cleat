import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCAL_DOCKER_MESSAGE, assertDockerWhenLocal, seedNeedsLocalDocker } from "./local-docker";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const HOSTED_URL = "postgresql://postgres:secret@db.example.supabase.co:5432/postgres";

test("local docker is required only for the default local url", () => {
  assert.equal(seedNeedsLocalDocker(undefined), true);
  assert.equal(seedNeedsLocalDocker(""), true);
  assert.equal(seedNeedsLocalDocker("   "), true);
  assert.equal(seedNeedsLocalDocker(DEFAULT_URL), true);
  assert.equal(seedNeedsLocalDocker("postgresql://postgres:postgres@localhost:54322/postgres"), true);
  assert.equal(seedNeedsLocalDocker("postgres://other:other@127.0.0.1:54322/otherdb"), true);
  assert.equal(seedNeedsLocalDocker(HOSTED_URL), false);
  assert.equal(seedNeedsLocalDocker("postgresql://postgres:postgres@127.0.0.1:5432/postgres"), false);
  assert.equal(seedNeedsLocalDocker("postgresql://postgres:postgres@localhost:5432/postgres"), false);
  assert.equal(seedNeedsLocalDocker("not a url"), false);
});

test("docker info runs only when the seed needs local docker", () => {
  let calls = 0;
  assertDockerWhenLocal(HOSTED_URL, () => {
    calls += 1;
    throw new Error("docker should not run");
  });
  assert.equal(calls, 0);

  assert.throws(
    () =>
      assertDockerWhenLocal(undefined, () => {
        throw new Error("daemon down");
      }),
    { message: LOCAL_DOCKER_MESSAGE },
  );

  assert.doesNotThrow(() => assertDockerWhenLocal(DEFAULT_URL, () => undefined));
  assert.equal(LOCAL_DOCKER_MESSAGE.includes("—") || LOCAL_DOCKER_MESSAGE.includes("–"), false);
});
