import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCKER_MESSAGE =
  "Docker is not running. Open Docker Desktop, wait until it says running, then try again.";

function bash(args, env = process.env) {
  try {
    const stdout = execFileSync("bash", args, {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

function commandPath(name) {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

function writeExec(file, body) {
  writeFileSync(file, body);
  chmodSync(file, 0o755);
}

function statusFixture(anon = "anon-key-value", service = "service-role-value") {
  return [
    `ANON_KEY="${anon}"`,
    'API_URL="http://127.0.0.1:54321"',
    'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
    'GRAPHQL_URL="http://127.0.0.1:54321/graphql/v1"',
    `SERVICE_ROLE_KEY="${service}"`,
    'STUDIO_URL="http://127.0.0.1:54323"',
    "",
  ].join("\n");
}

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "cleat-onboarding-"));
  mkdirSync(join(dir, "apps", "web"), { recursive: true });
  mkdirSync(join(dir, "apps", "mobile"), { recursive: true });
  mkdirSync(join(dir, "packages", "db"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ packageManager: "pnpm@10.33.3" }));
  return dir;
}

test("shell scripts pass bash -n", () => {
  const files = [
    ...readdirSync(join(root, "scripts"))
      .filter((name) => name.endsWith(".sh"))
      .map((name) => join(root, "scripts", name)),
    ...readdirSync(join(root, "scripts", "lib"))
      .filter((name) => name.endsWith(".sh"))
      .map((name) => join(root, "scripts", "lib", name)),
  ];
  assert.ok(files.length >= 8);
  for (const file of files) {
    const result = bash(["-n", file]);
    assert.equal(result.status, 0, `${file}\n${result.stderr}`);
  }
});

test("docker not running message is the seed guard sentence", () => {
  const ts = readFileSync(join(root, "packages/db/src/local-docker.ts"), "utf8");
  assert.match(ts, new RegExp(DOCKER_MESSAGE.replace(/[.]/g, "\\.")));
  const result = bash(["-c", "source scripts/lib/prereqs.sh && cleat_docker_not_running_message \"$PWD\""]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), DOCKER_MESSAGE);
});

test("docker check prints install or open commands", () => {
  const missing = bash([
    "-c",
    "source scripts/lib/prereqs.sh && cleat_check_docker \"$PWD\"",
  ], { ...process.env, PATH: "/usr/bin:/bin" });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /Docker is not installed\./);
  assert.match(missing.stdout, /Fix: brew install --cask docker && open -a Docker/);
  assert.match(missing.stdout, /Then verify with: docker info/);

  const bin = mkdtempSync(join(tmpdir(), "cleat-docker-"));
  writeExec(join(bin, "docker"), "#!/usr/bin/env bash\nexit 1\n");
  const down = bash(["-c", "source scripts/lib/prereqs.sh && cleat_check_docker \"$PWD\""], {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
  });
  assert.equal(down.status, 1, down.stdout + down.stderr);
  assert.match(down.stdout, new RegExp(DOCKER_MESSAGE.replace(/[.]/g, "\\.")));
  assert.match(down.stdout, /Fix: open -a Docker/);
  rmSync(bin, { recursive: true, force: true });
});

test("node, pnpm, and supabase checks print fix commands", () => {
  const bin = mkdtempSync(join(tmpdir(), "cleat-node-"));
  writeExec(
    join(bin, "node"),
    "#!/usr/bin/env bash\nif [ \"$1\" = \"-p\" ]; then echo 20; exit 0; fi\necho v20.11.0\n",
  );
  const oldNode = bash(["-c", "source scripts/lib/prereqs.sh && cleat_check_node"], {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    NVM_DIR: "",
  });
  assert.equal(oldNode.status, 1);
  assert.match(oldNode.stdout, /Node\.js 22 or newer is required/);
  assert.match(oldNode.stdout, /Fix: brew install node@22/);

  const nvmDir = mkdtempSync(join(tmpdir(), "cleat-nvm-"));
  writeFileSync(join(nvmDir, "nvm.sh"), "# nvm\n");
  const nvmNode = bash(["-c", "source scripts/lib/prereqs.sh && cleat_check_node"], {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    NVM_DIR: nvmDir,
  });
  assert.equal(nvmNode.status, 1);
  assert.match(nvmNode.stdout, /Fix: nvm install && nvm use/);

  const noPnpm = bash(
    ["-c", `source scripts/lib/prereqs.sh && cleat_check_pnpm "${root}"`],
    { ...process.env, PATH: "/usr/bin:/bin" },
  );
  assert.equal(noPnpm.status, 1);
  assert.match(noPnpm.stdout, /Fix: corepack enable && corepack prepare pnpm@10\.33\.3 --activate|Fix: brew install node@22 && corepack enable/);

  const noSupabase = bash(["-c", "source scripts/lib/prereqs.sh && cleat_check_supabase"], {
    ...process.env,
    PATH: "/usr/bin:/bin",
  });
  assert.equal(noSupabase.status, 1);
  assert.match(noSupabase.stdout, /Supabase CLI is not installed\./);
  assert.match(noSupabase.stdout, /Fix: brew install supabase\/tap\/supabase/);
  rmSync(bin, { recursive: true, force: true });
  rmSync(nvmDir, { recursive: true, force: true });
});

test("setup stops before install when docker and supabase are missing", () => {
  const bin = mkdtempSync(join(tmpdir(), "cleat-path-"));
  for (const name of ["node", "pnpm", "corepack", "uname", "dirname", "pwd"]) {
    const src = commandPath(name);
    assert.ok(src, `missing ${name}`);
    symlinkSync(src, join(bin, name));
  }
  const env = { ...process.env, PATH: `${bin}:/bin` };
  const webFile = join(root, "apps/web/.env.local");
  const mobileFile = join(root, "apps/mobile/.env");
  const beforeWeb = existsSync(webFile) ? readFileSync(webFile) : null;
  const beforeMobile = existsSync(mobileFile) ? readFileSync(mobileFile) : null;
  const first = bash(["scripts/setup.sh"], env);
  const second = bash(["scripts/setup.sh"], env);
  assert.equal(first.status, 1, first.stdout + first.stderr);
  assert.equal(second.status, 1, second.stdout + second.stderr);
  for (const result of [first, second]) {
    assert.match(result.stdout, /Docker is not installed\./);
    assert.match(result.stdout, /Fix: brew install --cask docker && open -a Docker/);
    assert.match(result.stdout, /Supabase CLI is not installed\./);
    assert.match(result.stdout, /Fix: brew install supabase\/tap\/supabase/);
    assert.doesNotMatch(result.stdout, /Installing dependencies/);
    assert.match(result.stdout, /Setup stopped\. Run the fix commands above, then run pnpm run setup again\./);
  }
  const afterWeb = existsSync(webFile) ? readFileSync(webFile) : null;
  const afterMobile = existsSync(mobileFile) ? readFileSync(mobileFile) : null;
  assert.deepEqual(afterWeb, beforeWeb);
  assert.deepEqual(afterMobile, beforeMobile);
  rmSync(bin, { recursive: true, force: true });
});

test("write-env maps status into web and mobile files", () => {
  const dir = tempRoot();
  const status = join(dir, "status.env");
  writeFileSync(status, statusFixture());
  const env = { ...process.env, CLEAT_ROOT: dir, CLEAT_LAN_IP: "192.168.4.20" };
  const first = bash(["scripts/lib/write-env.sh", status], env);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const web = readFileSync(join(dir, "apps/web/.env.local"), "utf8");
  const mobile = readFileSync(join(dir, "apps/mobile/.env"), "utf8");
  const second = bash(["scripts/lib/write-env.sh", status], env);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(readFileSync(join(dir, "apps/web/.env.local"), "utf8"), web);
  assert.equal(readFileSync(join(dir, "apps/mobile/.env"), "utf8"), mobile);
  assert.match(web, /NEXT_PUBLIC_SUPABASE_URL="http:\/\/127\.0\.0\.1:54321"/);
  assert.match(web, /SUPABASE_SERVICE_ROLE="service-role-value"/);
  assert.match(web, /ICS_FEED_SIGNING_SECRET="cleat-demo-ics-secret"/);
  assert.doesNotMatch(web, /postgresql:\/\//);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_URL="http:\/\/192\.168\.4\.20:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_DESK_URL="http:\/\/192\.168\.4\.20:3000"/);
  assert.match(mobile, /EXPO_PUBLIC_WEB_URL="http:\/\/192\.168\.4\.20:3000"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-key-value"/);
  assert.doesNotMatch(mobile, /service-role-value/);
  assert.doesNotMatch(mobile, /SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(mobile, /SERVICE_ROLE/);
  assert.match(first.stdout, /Mobile Supabase URL: http:\/\/192\.168\.4\.20:54321/);
  rmSync(dir, { recursive: true, force: true });
});

test("write-env accepts export lines and keeps local secrets", () => {
  const dir = tempRoot();
  const status = join(dir, "status.env");
  writeFileSync(
    status,
    [
      "export ANON_KEY=anon-one",
      "export API_URL=http://127.0.0.1:54321",
      "export SERVICE_ROLE_KEY=service-one",
      "export DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "",
    ].join("\n"),
  );
  const env = { ...process.env, CLEAT_ROOT: dir, CLEAT_LAN_IP: "10.1.2.3" };
  assert.equal(bash(["scripts/lib/write-env.sh", status], env).status, 0);
  const webPath = join(dir, "apps/web/.env.local");
  const web = readFileSync(webPath, "utf8")
    .replace(
      'ICS_FEED_SIGNING_SECRET="cleat-demo-ics-secret"',
      'ICS_FEED_SIGNING_SECRET="custom-ics-secret-value"',
    )
    .replace(
      'NEXT_PUBLIC_CLIENT_APP_URL="http://localhost:8081"',
      'NEXT_PUBLIC_CLIENT_APP_URL="http://localhost:8090"',
    );
  writeFileSync(webPath, `${web}OPENAI_API_KEY="sk-local-test"\nGOOGLE_CLIENT_ID="google-client"\n`);
  writeFileSync(
    status,
    [
      "export ANON_KEY=anon-two",
      "export API_URL=http://localhost:54321",
      "export SERVICE_ROLE_KEY=service-two",
      "",
    ].join("\n"),
  );
  const again = bash(["scripts/lib/write-env.sh", status], env);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  const next = readFileSync(webPath, "utf8");
  const mobile = readFileSync(join(dir, "apps/mobile/.env"), "utf8");
  assert.match(next, /NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-two"/);
  assert.match(next, /SUPABASE_SERVICE_ROLE="service-two"/);
  assert.match(next, /ICS_FEED_SIGNING_SECRET="custom-ics-secret-value"/);
  assert.match(next, /OPENAI_API_KEY="sk-local-test"/);
  assert.match(next, /GOOGLE_CLIENT_ID="google-client"/);
  assert.match(next, /NEXT_PUBLIC_CLIENT_APP_URL="http:\/\/localhost:8090"/);
  assert.match(next, /NEXT_PUBLIC_SUPABASE_URL="http:\/\/localhost:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_URL="http:\/\/10\.1\.2\.3:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-two"/);
  assert.doesNotMatch(mobile, /service-two/);
  assert.doesNotMatch(mobile, /sk-local-test/);
  rmSync(dir, { recursive: true, force: true });
});

test("desk port falls back when 3000 is taken and says so", async () => {
  let server;
  try {
    server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(3000, "127.0.0.1", resolve);
    });
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
  }
  try {
    const result = bash([
      "-c",
      "source scripts/lib/ports.sh && port=$(cleat_pick_desk_port) && echo PORT:$port && cleat_announce_desk_port \"$port\"",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const port = result.stdout.match(/PORT:(\d+)/)?.[1];
    assert.ok(port);
    assert.notEqual(port, "3000");
    assert.match(result.stdout, new RegExp(`Port 3000 is in use\\. The desk is on port ${port}\\.`));
  } finally {
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  const hook = mkdtempSync(join(tmpdir(), "cleat-hook-"));
  const hookFile = join(hook, "hook.sh");
  writeExec(hookFile, "#!/usr/bin/env bash\nif [ \"$1\" = \"3000\" ] || [ \"$1\" = \"3001\" ]; then exit 0; fi\nexit 1\n");
  const skipped = bash(["-c", "source scripts/lib/ports.sh && cleat_pick_desk_port"], {
    ...process.env,
    CLEAT_PORT_IN_USE_HOOK: hookFile,
  });
  assert.equal(skipped.stdout.trim(), "3002");
  const freeHook = join(hook, "free.sh");
  writeExec(freeHook, "#!/usr/bin/env bash\nexit 1\n");
  const free = bash(
    ["-c", "source scripts/lib/ports.sh && cleat_pick_desk_port && cleat_announce_desk_port 3000"],
    { ...process.env, CLEAT_PORT_IN_USE_HOOK: freeHook },
  );
  assert.equal(free.stdout.trim(), "3000");
  rmSync(hook, { recursive: true, force: true });
});

test("lan detection prints an address", () => {
  const result = bash(["-c", "source scripts/lib/lan.sh && cleat_lan_ip"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+\.\d+$/);
  const forced = bash(["-c", "source scripts/lib/lan.sh && cleat_lan_ip"], {
    ...process.env,
    CLEAT_LAN_IP: "10.9.8.7",
  });
  assert.equal(forced.stdout.trim(), "10.9.8.7");
});

function devEnv(dir, extra = {}) {
  const bin = mkdtempSync(join(tmpdir(), "cleat-devbin-"));
  writeExec(join(bin, "docker"), "#!/usr/bin/env bash\nexit 0\n");
  return {
    env: {
      ...process.env,
      ...extra,
      PATH: `${bin}:${process.env.PATH}`,
      CLEAT_ROOT: dir,
      CLEAT_DEV_STUB: "1",
      CLEAT_LAN_IP: "192.168.4.20",
    },
    bin,
  };
}

function waitFor(predicate, timeoutMs, detail) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error(detail()));
      }
    }, 40);
  });
}

test("dev and stop pick a free port and tear the processes down", async () => {
  const dir = tempRoot();
  writeFileSync(
    join(dir, "apps/web/.env.local"),
    'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="anon"\nSUPABASE_SERVICE_ROLE="service-role-value"\n',
  );
  writeFileSync(
    join(dir, "apps/mobile/.env"),
    [
      'EXPO_PUBLIC_SUPABASE_URL="http://192.168.4.20:54321"',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY="anon"',
      'EXPO_PUBLIC_DESK_URL="http://192.168.4.20:3000"',
      'EXPO_PUBLIC_WEB_URL="http://192.168.4.20:3000"',
      "",
    ].join("\n"),
  );
  const hookDir = mkdtempSync(join(tmpdir(), "cleat-devhook-"));
  const hookFile = join(hookDir, "hook.sh");
  writeExec(hookFile, "#!/usr/bin/env bash\nif [ \"$1\" = \"3000\" ]; then exit 0; fi\nexit 1\n");
  const { env, bin } = devEnv(dir, { CLEAT_PORT_IN_USE_HOOK: hookFile });
  const child = spawn("bash", [join(root, "scripts/dev.sh")], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitFor(
      () => output.includes("Stop with pnpm stop.") && existsSync(join(dir, ".cleat/dev.pid")),
      8000,
      () => output,
    );
    assert.match(output, /Docker: ok/);
    assert.match(output, /Port 3000 is in use\. The desk is on port 3001\./);
    assert.match(output, /Updated apps\/mobile\/\.env desk URLs to port 3001\./);
    assert.match(output, /Desk: http:\/\/localhost:3001/);
    assert.match(output, /Scan the QR code with Expo Go/);
    const mobile = readFileSync(join(dir, "apps/mobile/.env"), "utf8");
    assert.match(mobile, /EXPO_PUBLIC_DESK_URL="http:\/\/192\.168\.4\.20:3001"/);
    assert.match(mobile, /EXPO_PUBLIC_WEB_URL="http:\/\/192\.168\.4\.20:3001"/);
    assert.match(mobile, /EXPO_PUBLIC_SUPABASE_ANON_KEY="anon"/);
    assert.doesNotMatch(mobile, /service-role-value/);
    const devPid = Number(readFileSync(join(dir, ".cleat/dev.pid"), "utf8").trim());
    const webPid = Number(readFileSync(join(dir, ".cleat/web.pid"), "utf8").trim());
    assert.equal(process.kill(devPid, 0), true);
    assert.equal(process.kill(webPid, 0), true);

    const stopped = bash(["scripts/stop.sh"], env);
    assert.equal(stopped.status, 0, stopped.stdout + stopped.stderr);
    assert.match(stopped.stdout, /Stopped the Cleat desk and Expo\./);
    await waitFor(
      () => {
        try {
          process.kill(devPid, 0);
          return false;
        } catch {
          return true;
        }
      },
      4000,
      () => `dev pid ${devPid} still alive\n${output}`,
    );
    assert.throws(() => process.kill(webPid, 0));
    const again = bash(["scripts/stop.sh"], env);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /Cleat dev is not running\./);
  } finally {
    bash(["scripts/stop.sh"], env);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
    rmSync(hookDir, { recursive: true, force: true });
  }
});

test("dev skips the docker check for a non loopback URL", async () => {
  const dir = tempRoot();
  writeFileSync(
    join(dir, "apps/web/.env.local"),
    'NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="anon"\n',
  );
  writeFileSync(
    join(dir, "apps/mobile/.env"),
    'EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"\nEXPO_PUBLIC_DESK_URL="http://10.0.0.8:3000"\nEXPO_PUBLIC_WEB_URL="http://10.0.0.8:3000"\n',
  );
  const hookDir = mkdtempSync(join(tmpdir(), "cleat-freehook-"));
  const hookFile = join(hookDir, "free.sh");
  writeExec(hookFile, "#!/usr/bin/env bash\nexit 1\n");
  const env = {
    ...process.env,
    PATH: "/usr/bin:/bin",
    CLEAT_ROOT: dir,
    CLEAT_DEV_STUB: "1",
    CLEAT_LAN_IP: "10.0.0.8",
    CLEAT_PORT_IN_USE_HOOK: hookFile,
  };
  const child = spawn("bash", [join(root, "scripts/dev.sh")], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitFor(
      () => output.includes("Stop with pnpm stop.") || output.includes("Fix:"),
      8000,
      () => output,
    );
    assert.match(output, /Desk: http:\/\/localhost:3000/);
    assert.doesNotMatch(output, /Docker is not installed/);
    assert.doesNotMatch(output, /Docker: ok/);
    assert.doesNotMatch(output, /Port 3000 is in use/);
  } finally {
    bash(["scripts/stop.sh"], env);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
    rmSync(hookDir, { recursive: true, force: true });
  }
});

test("setup with stubbed tools writes env twice and does not reset", () => {
  const dir = tempRoot();
  const bin = mkdtempSync(join(tmpdir(), "cleat-stubs-"));
  const supabaseLog = join(dir, "supabase.log");
  const pnpmLog = join(dir, "pnpm.log");
  const status = join(dir, "status.env");
  writeFileSync(status, statusFixture());
  writeFileSync(supabaseLog, "");
  writeFileSync(pnpmLog, "");
  writeExec(
    join(bin, "docker"),
    "#!/usr/bin/env bash\nexit 0\n",
  );
  writeExec(
    join(bin, "supabase"),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CLEAT_SUPABASE_LOG"
if [ "$1" = "status" ]; then
  cat "$CLEAT_FAKE_STATUS"
fi
exit 0
`,
  );
  writeExec(
    join(bin, "pnpm"),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CLEAT_PNPM_LOG"
if [ "$1" = "--version" ]; then
  echo 10.33.3
fi
exit 0
`,
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    CLEAT_ROOT: dir,
    CLEAT_LAN_IP: "192.168.9.9",
    CLEAT_FAKE_STATUS: status,
    CLEAT_SUPABASE_LOG: supabaseLog,
    CLEAT_PNPM_LOG: pnpmLog,
  };
  const first = bash(["scripts/setup.sh"], env);
  const webAfterFirst = readFileSync(join(dir, "apps/web/.env.local"), "utf8");
  const mobileAfterFirst = readFileSync(join(dir, "apps/mobile/.env"), "utf8");
  const second = bash(["scripts/setup.sh"], env);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(readFileSync(join(dir, "apps/web/.env.local"), "utf8"), webAfterFirst);
  assert.equal(readFileSync(join(dir, "apps/mobile/.env"), "utf8"), mobileAfterFirst);
  assert.match(mobileAfterFirst, /EXPO_PUBLIC_SUPABASE_URL="http:\/\/192\.168\.9\.9:54321"/);
  assert.doesNotMatch(mobileAfterFirst, /service-role-value/);
  assert.match(webAfterFirst, /SUPABASE_SERVICE_ROLE="service-role-value"/);
  const supabase = readFileSync(supabaseLog, "utf8");
  const pnpm = readFileSync(pnpmLog, "utf8");
  assert.equal(supabase.split("\n").filter((line) => line === "start").length, 2);
  assert.equal(supabase.split("\n").filter((line) => line === "migration up --local").length, 2);
  assert.equal(supabase.split("\n").filter((line) => line === "status -o env").length, 2);
  assert.doesNotMatch(supabase, /reset/);
  assert.equal(pnpm.split("\n").filter((line) => line === "install").length, 2);
  assert.equal(pnpm.split("\n").filter((line) => line === "seed").length, 2);
  assert.match(first.stdout, /Setup finished\. Next: pnpm dev\. Stop: pnpm stop\./);
  assert.match(second.stdout, /Setup finished\. Next: pnpm dev\. Stop: pnpm stop\./);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});
