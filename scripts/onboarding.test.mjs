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

const POSIX_TOOLS = [
  "bash",
  "uname",
  "dirname",
  "pwd",
  "grep",
  "sed",
  "awk",
  "mktemp",
  "mv",
  "cat",
  "rm",
  "mkdir",
  "tr",
  "ps",
  "pgrep",
  "sleep",
  "kill",
  "tail",
  "timeout",
  "hostname",
  "cp",
  "ln",
  "head",
  "tee",
  "date",
  "env",
  "ls",
  "touch",
  "chmod",
  "basename",
  "id",
];

const STRIP_KEYS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "CLEAT_ROOT",
  "CLEAT_LAN_IP",
  "CLEAT_DEV_STUB",
  "CLEAT_PORT_IN_USE_HOOK",
  "CLEAT_DB_REACHABLE",
  "CLEAT_FAKE_STATUS",
  "CLEAT_SUPABASE_LOG",
  "CLEAT_PNPM_LOG",
  "CLEAT_PSQL_LOG",
  "CLEAT_PSQL_STATE",
  "CLEAT_CURL_LOG",
  "NVM_DIR",
];

const SIGN_IN_LINE =
  "Sign in needs Supabase, local or hosted. For a local stack, unset DATABASE_URL and run pnpm run setup with Docker and the Supabase CLI. For a hosted project, create one at https://supabase.com and set its URL and anon key.";

const fakeNodeOld = `#!/usr/bin/env bash
if [ "$1" = "-p" ]; then echo 20; exit 0; fi
echo v20.11.0
`;

const fakeNodeOk = `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then echo v22.14.0; exit 0; fi
if [ "$1" = "-p" ]; then
  case "$2" in
    *packageManager*) echo 10.33.3 ;;
    *) echo 22 ;;
  esac
  exit 0
fi
echo v22.14.0
`;

const fakeCorepack = "#!/usr/bin/env bash\nexit 0\n";

const fakePnpm = `#!/usr/bin/env bash
printf '%s\\n' "DATABASE_URL=\${DATABASE_URL-}" >> "\${CLEAT_PNPM_LOG:-/tmp/cleat-pnpm.log}"
printf '%s\\n' "$*" >> "\${CLEAT_PNPM_LOG:-/tmp/cleat-pnpm.log}"
if [ "$1" = "--version" ]; then
  echo 10.33.3
fi
exit 0
`;

const fakeDockerOk = "#!/usr/bin/env bash\nexit 0\n";
const fakeDockerDown = "#!/usr/bin/env bash\nexit 1\n";

const fakeSupabase = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${CLEAT_SUPABASE_LOG:-/tmp/cleat-supabase.log}"
if [ "$1" = "status" ]; then
  cat "\${CLEAT_FAKE_STATUS:?}"
fi
exit 0
`;

const fakePsql = `#!/usr/bin/env bash
log="\${CLEAT_PSQL_LOG:-/tmp/cleat-psql.log}"
state="\${CLEAT_PSQL_STATE:-/tmp/cleat-psql-state}"
touch "$log" "$state"
printf '%s\\n' "$*" >> "$log"
sql=""
file=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-c" ] || [ "$prev" = "-tAc" ]; then
    sql="$arg"
  fi
  if [ "$prev" = "-f" ]; then
    file="$arg"
  fi
  prev="$arg"
done
if [ "$sql" = "select 1" ]; then
  if [ "\${CLEAT_DB_REACHABLE:-1}" = "0" ]; then
    exit 1
  fi
  exit 0
fi
if [ -n "$file" ]; then
  base=$(basename "$file")
  printf '%s\\n' "FILE:$base" >> "$log"
  exit 0
fi
case "$sql" in
  "select version from supabase_migrations.schema_migrations where version ="*)
    version=$(printf '%s' "$sql" | sed -n "s/.*version = '\\([^']*\\)'.*/\\1/p")
    if grep -qx "$version" "$state"; then
      printf '%s\\n' "$version"
    fi
    exit 0
    ;;
  "insert into supabase_migrations.schema_migrations"*)
    version=$(printf '%s' "$sql" | sed -n "s/.*values ('\\([^']*\\)').*/\\1/p")
    printf '%s\\n' "$version" >> "$state"
    exit 0
    ;;
esac
exit 0
`;

const fakeCurl = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${CLEAT_CURL_LOG:-/tmp/cleat-curl.log}"
for arg in "$@"; do
  case "$arg" in
    *unreached*) exit 1 ;;
  esac
done
exit 0
`;

function hermeticBin({ link = [], fakes = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cleat-hermetic-"));
  const skip = new Set(Object.keys(fakes));
  for (const name of [...POSIX_TOOLS, ...link]) {
    if (skip.has(name)) continue;
    const src = commandPath(name);
    if (!src) continue;
    const dest = join(dir, name);
    if (!existsSync(dest)) symlinkSync(src, dest);
  }
  for (const [name, body] of Object.entries(fakes)) {
    writeExec(join(dir, name), body);
  }
  return dir;
}

function hermeticEnv(bin, extra = {}) {
  const env = { ...process.env, ...extra, PATH: bin };
  for (const key of STRIP_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(extra, key)) delete env[key];
  }
  env.PATH = bin;
  return env;
}

function requireTool(bin, name) {
  assert.ok(existsSync(join(bin, name)), `hermetic PATH is missing ${name}`);
}

test("shell scripts pass bash -n", () => {
  const bin = hermeticBin();
  const env = hermeticEnv(bin);
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
    const result = bash(["-n", file], env);
    assert.equal(result.status, 0, `${file}\n${result.stderr}`);
  }
  rmSync(bin, { recursive: true, force: true });
});

test("docker not running message is the seed guard sentence", () => {
  const ts = readFileSync(join(root, "packages/db/src/local-docker.ts"), "utf8");
  assert.match(ts, new RegExp(DOCKER_MESSAGE.replace(/[.]/g, "\\.")));
  const bin = hermeticBin();
  const result = bash(
    ["-c", 'source scripts/lib/prereqs.sh && cleat_docker_not_running_message "$PWD"'],
    hermeticEnv(bin),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), DOCKER_MESSAGE);
  rmSync(bin, { recursive: true, force: true });
});

test("docker check prints install or open commands", () => {
  const bare = hermeticBin();
  const missing = bash(
    ["-c", 'source scripts/lib/prereqs.sh && cleat_check_docker "$PWD"'],
    hermeticEnv(bare),
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /Docker is not installed\./);
  assert.match(missing.stdout, /Fix: brew install --cask docker && open -a Docker/);
  assert.match(missing.stdout, /Then verify with: docker info/);
  rmSync(bare, { recursive: true, force: true });

  const bin = hermeticBin({ fakes: { docker: fakeDockerDown } });
  const down = bash(
    ["-c", 'source scripts/lib/prereqs.sh && cleat_check_docker "$PWD"'],
    hermeticEnv(bin),
  );
  assert.equal(down.status, 1, down.stdout + down.stderr);
  assert.match(down.stdout, new RegExp(DOCKER_MESSAGE.replace(/[.]/g, "\\.")));
  assert.match(down.stdout, /Fix: open -a Docker/);
  rmSync(bin, { recursive: true, force: true });
});

test("node, pnpm, and supabase checks print fix commands", () => {
  const bin = hermeticBin({ fakes: { node: fakeNodeOld } });
  const oldNode = bash(
    ["-c", "source scripts/lib/prereqs.sh && cleat_check_node"],
    hermeticEnv(bin),
  );
  assert.equal(oldNode.status, 1);
  assert.match(oldNode.stdout, /Node\.js 22 or newer is required/);
  assert.match(oldNode.stdout, /Fix: brew install node@22/);

  const nvmDir = mkdtempSync(join(tmpdir(), "cleat-nvm-"));
  writeFileSync(join(nvmDir, "nvm.sh"), "# nvm\n");
  const nvmNode = bash(
    ["-c", "source scripts/lib/prereqs.sh && cleat_check_node"],
    hermeticEnv(bin, { NVM_DIR: nvmDir }),
  );
  assert.equal(nvmNode.status, 1);
  assert.match(nvmNode.stdout, /Fix: nvm install && nvm use/);

  const empty = hermeticBin();
  const noPnpm = bash(
    ["-c", `source scripts/lib/prereqs.sh && cleat_check_pnpm "${root}"`],
    hermeticEnv(empty),
  );
  assert.equal(noPnpm.status, 1, noPnpm.stdout + noPnpm.stderr);
  assert.equal(noPnpm.stdout.includes("/usr/bin"), false);
  assert.match(
    noPnpm.stdout,
    /Fix: corepack enable && corepack prepare pnpm@10\.33\.3 --activate|Fix: brew install node@22 && corepack enable/,
  );

  const noSupabase = bash(
    ["-c", "source scripts/lib/prereqs.sh && cleat_check_supabase"],
    hermeticEnv(empty),
  );
  assert.equal(noSupabase.status, 1);
  assert.match(noSupabase.stdout, /Supabase CLI is not installed\./);
  assert.match(noSupabase.stdout, /Fix: brew install supabase\/tap\/supabase/);
  rmSync(bin, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
  rmSync(nvmDir, { recursive: true, force: true });
});

test("setup stops before install when docker and supabase are missing", () => {
  const bin = hermeticBin({ link: ["node", "pnpm", "corepack"] });
  for (const name of ["node", "pnpm", "corepack"]) requireTool(bin, name);
  assert.equal(existsSync(join(bin, "docker")), false);
  assert.equal(existsSync(join(bin, "supabase")), false);
  const env = hermeticEnv(bin);
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
  const bin = hermeticBin();
  const status = join(dir, "status.env");
  writeFileSync(status, statusFixture());
  const env = hermeticEnv(bin, { CLEAT_ROOT: dir, CLEAT_LAN_IP: "192.168.4.20" });
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
  rmSync(bin, { recursive: true, force: true });
});

test("write-env accepts export lines and keeps local secrets", () => {
  const dir = tempRoot();
  const bin = hermeticBin();
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
  const env = hermeticEnv(bin, { CLEAT_ROOT: dir, CLEAT_LAN_IP: "10.1.2.3" });
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
  writeFileSync(
    webPath,
    `${web}DATABASE_URL="postgresql://fromfile:fromfile@127.0.0.1:5491/app"\nOPENAI_API_KEY="sk-local-test"\nGOOGLE_CLIENT_ID="google-client"\n`,
  );
  writeFileSync(
    status,
    [
      "export ANON_KEY=anon-two",
      "export API_URL=http://localhost:54321",
      "export SERVICE_ROLE_KEY=service-two",
      "export DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "",
    ].join("\n"),
  );
  const again = bash(["scripts/lib/write-env.sh", status], env);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  const next = readFileSync(webPath, "utf8");
  const mobile = readFileSync(join(dir, "apps/mobile/.env"), "utf8");
  assert.match(next, /NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-one"/);
  assert.match(next, /SUPABASE_SERVICE_ROLE="service-one"/);
  assert.match(next, /DATABASE_URL="postgresql:\/\/fromfile:fromfile@127\.0\.0\.1:5491\/app"/);
  assert.doesNotMatch(next, /54322/);
  assert.match(next, /ICS_FEED_SIGNING_SECRET="custom-ics-secret-value"/);
  assert.match(next, /OPENAI_API_KEY="sk-local-test"/);
  assert.match(next, /GOOGLE_CLIENT_ID="google-client"/);
  assert.match(next, /NEXT_PUBLIC_CLIENT_APP_URL="http:\/\/localhost:8090"/);
  assert.match(next, /NEXT_PUBLIC_SUPABASE_URL="http:\/\/127\.0\.0\.1:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_URL="http:\/\/10\.1\.2\.3:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-one"/);
  assert.doesNotMatch(mobile, /service-one/);
  assert.doesNotMatch(mobile, /service-two/);
  assert.doesNotMatch(mobile, /sk-local-test/);
  assert.doesNotMatch(mobile, /DATABASE_URL/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
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
    const portBin = hermeticBin();
    const result = bash(
      [
        "-c",
        'source scripts/lib/ports.sh && port=$(cleat_pick_desk_port) && echo PORT:$port && cleat_announce_desk_port "$port"',
      ],
      hermeticEnv(portBin),
    );
    assert.equal(result.status, 0, result.stderr);
    const port = result.stdout.match(/PORT:(\d+)/)?.[1];
    assert.ok(port);
    assert.notEqual(port, "3000");
    assert.match(result.stdout, new RegExp(`Port 3000 is in use\\. The desk is on port ${port}\\.`));
    rmSync(portBin, { recursive: true, force: true });
  } finally {
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  const hook = mkdtempSync(join(tmpdir(), "cleat-hook-"));
  const hookBin = hermeticBin();
  const hookFile = join(hook, "hook.sh");
  writeExec(hookFile, "#!/usr/bin/env bash\nif [ \"$1\" = \"3000\" ] || [ \"$1\" = \"3001\" ]; then exit 0; fi\nexit 1\n");
  const skipped = bash(
    ["-c", "source scripts/lib/ports.sh && cleat_pick_desk_port"],
    hermeticEnv(hookBin, { CLEAT_PORT_IN_USE_HOOK: hookFile }),
  );
  assert.equal(skipped.stdout.trim(), "3002");
  const freeHook = join(hook, "free.sh");
  writeExec(freeHook, "#!/usr/bin/env bash\nexit 1\n");
  const free = bash(
    ["-c", "source scripts/lib/ports.sh && cleat_pick_desk_port && cleat_announce_desk_port 3000"],
    hermeticEnv(hookBin, { CLEAT_PORT_IN_USE_HOOK: freeHook }),
  );
  assert.equal(free.stdout.trim(), "3000");
  rmSync(hook, { recursive: true, force: true });
  rmSync(hookBin, { recursive: true, force: true });
});

test("lan detection prints an address", () => {
  const bin = hermeticBin({ link: ["node"] });
  requireTool(bin, "node");
  const result = bash(["-c", "source scripts/lib/lan.sh && cleat_lan_ip"], hermeticEnv(bin));
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+\.\d+$/);
  const forced = bash(
    ["-c", "source scripts/lib/lan.sh && cleat_lan_ip"],
    hermeticEnv(bin, { CLEAT_LAN_IP: "10.9.8.7" }),
  );
  assert.equal(forced.stdout.trim(), "10.9.8.7");
  rmSync(bin, { recursive: true, force: true });
});

function devEnv(dir, extra = {}) {
  const bin = hermeticBin({ fakes: { docker: fakeDockerOk } });
  for (const name of ["ps", "pgrep", "sleep", "bash"]) requireTool(bin, name);
  return {
    env: hermeticEnv(bin, {
      ...extra,
      CLEAT_ROOT: dir,
      CLEAT_DEV_STUB: "1",
      CLEAT_LAN_IP: "192.168.4.20",
    }),
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
  const bin = hermeticBin();
  assert.equal(existsSync(join(bin, "docker")), false);
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_DEV_STUB: "1",
    CLEAT_LAN_IP: "10.0.0.8",
    CLEAT_PORT_IN_USE_HOOK: hookFile,
  });
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
    rmSync(bin, { recursive: true, force: true });
  }
});

function localStackBin() {
  return hermeticBin({
    fakes: {
      node: fakeNodeOk,
      corepack: fakeCorepack,
      pnpm: fakePnpm,
      docker: fakeDockerOk,
      supabase: fakeSupabase,
      psql: fakePsql,
      curl: fakeCurl,
    },
  });
}

function existingStackBin() {
  return hermeticBin({
    fakes: {
      node: fakeNodeOk,
      corepack: fakeCorepack,
      pnpm: fakePnpm,
      psql: fakePsql,
      curl: fakeCurl,
    },
  });
}

function countLines(text, line) {
  return text.split("\n").filter((item) => item === line).length;
}

test("setup with stubbed tools writes env twice and does not reset", () => {
  const dir = tempRoot();
  const bin = localStackBin();
  const supabaseLog = join(dir, "supabase.log");
  const pnpmLog = join(dir, "pnpm.log");
  const status = join(dir, "status.env");
  writeFileSync(status, statusFixture());
  writeFileSync(supabaseLog, "");
  writeFileSync(pnpmLog, "");
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_LAN_IP: "192.168.9.9",
    CLEAT_FAKE_STATUS: status,
    CLEAT_SUPABASE_LOG: supabaseLog,
    CLEAT_PNPM_LOG: pnpmLog,
  });
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
  assert.doesNotMatch(webAfterFirst, /DATABASE_URL/);
  const supabase = readFileSync(supabaseLog, "utf8");
  const pnpm = readFileSync(pnpmLog, "utf8");
  assert.equal(countLines(supabase, "start"), 2);
  assert.equal(countLines(supabase, "migration up --local"), 2);
  assert.equal(countLines(supabase, "status -o env"), 2);
  assert.doesNotMatch(supabase, /reset/);
  assert.equal(countLines(pnpm, "install"), 2);
  assert.equal(countLines(pnpm, "seed"), 2);
  assert.match(
    pnpm,
    /DATABASE_URL=postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres\nseed/,
  );
  assert.match(first.stdout, /Docker: ok/);
  assert.match(first.stdout, /Supabase CLI: ok/);
  assert.match(first.stdout, /Setup finished\. Next: pnpm dev\. Stop: pnpm stop\./);
  assert.match(second.stdout, /Setup finished\. Next: pnpm dev\. Stop: pnpm stop\./);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup uses a reachable database and does not overwrite its url or keys", () => {
  const dir = tempRoot();
  const bin = existingStackBin();
  assert.equal(existsSync(join(bin, "docker")), false);
  assert.equal(existsSync(join(bin, "supabase")), false);
  const pnpmLog = join(dir, "pnpm.log");
  const psqlLog = join(dir, "psql.log");
  const psqlState = join(dir, "psql.state");
  const curlLog = join(dir, "curl.log");
  writeFileSync(pnpmLog, "");
  writeFileSync(psqlLog, "");
  writeFileSync(psqlState, "");
  writeFileSync(curlLog, "");
  const databaseUrl = "postgresql://fromfile:fromfile@127.0.0.1:5491/fromfile";
  const webPath = join(dir, "apps/web/.env.local");
  const mobilePath = join(dir, "apps/mobile/.env");
  const webBefore = [
    'NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-kept"',
    'SUPABASE_URL="https://example.supabase.co"',
    `DATABASE_URL="${databaseUrl}"`,
    'ICS_FEED_SIGNING_SECRET="kept-ics"',
    "",
  ].join("\n");
  const mobileBefore = [
    'EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-kept"',
    'EXPO_PUBLIC_DESK_URL="http://10.1.1.1:3000"',
    'EXPO_PUBLIC_WEB_URL="http://10.1.1.1:3000"',
    "",
  ].join("\n");
  writeFileSync(webPath, webBefore);
  writeFileSync(mobilePath, mobileBefore);
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_LAN_IP: "10.1.1.1",
    CLEAT_PNPM_LOG: pnpmLog,
    CLEAT_PSQL_LOG: psqlLog,
    CLEAT_PSQL_STATE: psqlState,
    CLEAT_CURL_LOG: curlLog,
    DATABASE_URL: "postgresql://fromenv:fromenv@127.0.0.1:5491/fromenv",
  });
  const first = bash(["scripts/setup.sh"], env);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(readFileSync(webPath, "utf8"), webBefore);
  assert.equal(readFileSync(mobilePath, "utf8"), mobileBefore);
  assert.match(first.stdout, /Docker and the Supabase CLI: skipped\./);
  assert.match(first.stdout, /Using the existing database\. Docker and the Supabase CLI are not required\./);
  assert.match(first.stdout, /Keeping existing env files\./);
  assert.doesNotMatch(first.stdout, /Docker is not installed/);
  assert.doesNotMatch(first.stdout, /Starting Supabase/);
  assert.equal(first.stdout.includes(SIGN_IN_LINE), false);
  const pnpm = readFileSync(pnpmLog, "utf8");
  assert.match(pnpm, /DATABASE_URL=postgresql:\/\/fromenv:fromenv@127\.0\.0\.1:5491\/fromenv\nseed/);
  assert.doesNotMatch(pnpm, /54322/);
  assert.doesNotMatch(pnpm, /fromfile/);
  const psql = readFileSync(psqlLog, "utf8");
  assert.match(psql, /postgresql:\/\/fromenv:fromenv@127\.0\.0\.1:5491\/fromenv/);
  assert.doesNotMatch(psql, /plain_postgres_auth_stub\.sql/);
  const migrations = readdirSync(join(root, "packages/db/supabase/migrations")).filter((name) =>
    name.endsWith(".sql"),
  );
  assert.ok(migrations.length >= 8);
  for (const name of migrations) {
    assert.equal(countLines(psql, `FILE:${name}`), 1, name);
  }
  const second = bash(["scripts/setup.sh"], env);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(readFileSync(webPath, "utf8"), webBefore);
  assert.equal(readFileSync(mobilePath, "utf8"), mobileBefore);
  const psqlAfter = readFileSync(psqlLog, "utf8");
  for (const name of migrations) {
    assert.equal(countLines(psqlAfter, `FILE:${name}`), 1, name);
  }
  assert.match(readFileSync(curlLog, "utf8"), /https:\/\/example\.supabase\.co\/auth\/v1\/health/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup migrates plain postgres and says sign in needs Supabase", () => {
  const dir = tempRoot();
  const bin = existingStackBin();
  const pnpmLog = join(dir, "pnpm.log");
  const psqlLog = join(dir, "psql.log");
  const psqlState = join(dir, "psql.state");
  writeFileSync(pnpmLog, "");
  writeFileSync(psqlLog, "");
  writeFileSync(psqlState, "");
  const databaseUrl = "postgresql://plain:plain@127.0.0.1:5491/plain";
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_PNPM_LOG: pnpmLog,
    CLEAT_PSQL_LOG: psqlLog,
    CLEAT_PSQL_STATE: psqlState,
    DATABASE_URL: databaseUrl,
  });
  const first = bash(["scripts/setup.sh"], env);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(first.stdout.split(SIGN_IN_LINE).length - 1, 1);
  assert.match(first.stdout, /Using the existing database\. Docker and the Supabase CLI are not required\./);
  assert.match(first.stdout, /Applying the plain Postgres auth stub\./);
  assert.doesNotMatch(first.stdout, /Docker is not installed/);
  assert.doesNotMatch(first.stdout, /Starting Supabase/);
  assert.equal(existsSync(join(dir, "apps/web/.env.local")), false);
  assert.equal(existsSync(join(dir, "apps/mobile/.env")), false);
  const psql = readFileSync(psqlLog, "utf8");
  assert.equal(countLines(psql, "FILE:plain_postgres_auth_stub.sql"), 1);
  const migrations = readdirSync(join(root, "packages/db/supabase/migrations")).filter((name) =>
    name.endsWith(".sql"),
  );
  for (const name of migrations) {
    assert.equal(countLines(psql, `FILE:${name}`), 1, name);
  }
  assert.match(readFileSync(pnpmLog, "utf8"), new RegExp(`DATABASE_URL=${databaseUrl}\\nseed`));
  const second = bash(["scripts/setup.sh"], env);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  const psqlAfter = readFileSync(psqlLog, "utf8");
  assert.equal(countLines(psqlAfter, "FILE:plain_postgres_auth_stub.sql"), 2);
  for (const name of migrations) {
    assert.equal(countLines(psqlAfter, `FILE:${name}`), 1, name);
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup keeps a configured local url when port 54322 is down", () => {
  const dir = tempRoot();
  const bin = localStackBin();
  const supabaseLog = join(dir, "supabase.log");
  const pnpmLog = join(dir, "pnpm.log");
  const status = join(dir, "status.env");
  writeFileSync(status, statusFixture("anon-from-status", "service-from-status"));
  writeFileSync(supabaseLog, "");
  writeFileSync(pnpmLog, "");
  const keptUrl = "postgresql://keep:keep@127.0.0.1:54322/keepdb";
  const webPath = join(dir, "apps/web/.env.local");
  const mobilePath = join(dir, "apps/mobile/.env");
  writeFileSync(
    webPath,
    [
      'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-kept"',
      'SUPABASE_URL="http://127.0.0.1:54321"',
      'SUPABASE_SERVICE_ROLE="service-kept"',
      `DATABASE_URL="${keptUrl}"`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    mobilePath,
    [
      'EXPO_PUBLIC_SUPABASE_URL="http://192.168.8.8:54321"',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-kept"',
      'EXPO_PUBLIC_DESK_URL="http://192.168.8.8:3000"',
      'EXPO_PUBLIC_WEB_URL="http://192.168.8.8:3000"',
      "",
    ].join("\n"),
  );
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_LAN_IP: "192.168.8.8",
    CLEAT_DB_REACHABLE: "0",
    CLEAT_FAKE_STATUS: status,
    CLEAT_SUPABASE_LOG: supabaseLog,
    CLEAT_PNPM_LOG: pnpmLog,
    DATABASE_URL: keptUrl,
  });
  const result = bash(["scripts/setup.sh"], env);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Starting Supabase/);
  assert.match(result.stdout, /Docker: ok/);
  assert.doesNotMatch(result.stdout, /Docker and the Supabase CLI: skipped/);
  const web = readFileSync(webPath, "utf8");
  const mobile = readFileSync(mobilePath, "utf8");
  assert.match(web, /NEXT_PUBLIC_SUPABASE_URL="http:\/\/127\.0\.0\.1:54321"/);
  assert.match(web, /NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-kept"/);
  assert.match(web, /SUPABASE_SERVICE_ROLE="service-kept"/);
  assert.match(web, /DATABASE_URL="postgresql:\/\/keep:keep@127\.0\.0\.1:54322\/keepdb"/);
  assert.doesNotMatch(web, /anon-from-status/);
  assert.doesNotMatch(web, /service-from-status/);
  assert.doesNotMatch(web, /postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_URL="http:\/\/192\.168\.8\.8:54321"/);
  assert.match(mobile, /EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-kept"/);
  const pnpm = readFileSync(pnpmLog, "utf8");
  assert.match(pnpm, /DATABASE_URL=postgresql:\/\/keep:keep@127\.0\.0\.1:54322\/keepdb\nseed/);
  assert.doesNotMatch(pnpm, /postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(readFileSync(supabaseLog, "utf8"), /start/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup stops when a non local database url is unreachable", () => {
  const dir = tempRoot();
  const bin = existingStackBin();
  const env = hermeticEnv(bin, {
    CLEAT_ROOT: dir,
    CLEAT_DB_REACHABLE: "0",
    DATABASE_URL: "postgresql://user:pass@10.9.9.9:5432/app",
  });
  const result = bash(["scripts/setup.sh"], env);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /DATABASE_URL is set but the database is not reachable\./);
  assert.match(result.stdout, /Fix: start that database, then run pnpm run setup again\./);
  assert.doesNotMatch(result.stdout, /Docker is not installed/);
  assert.doesNotMatch(result.stdout, /Supabase CLI is not installed/);
  assert.doesNotMatch(result.stdout, /Installing dependencies/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup stops when a supabase url has no anon key or database url", () => {
  const dir = tempRoot();
  const bin = existingStackBin();
  const missingAnon = bash(
    ["scripts/setup.sh"],
    hermeticEnv(bin, {
      CLEAT_ROOT: dir,
      DATABASE_URL: "postgresql://user:pass@10.9.9.9:5432/app",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    }),
  );
  assert.equal(missingAnon.status, 1, missingAnon.stdout + missingAnon.stderr);
  assert.match(missingAnon.stdout, /The Supabase URL is set but the anon key is missing\./);
  assert.match(missingAnon.stdout, /Fix: set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(missingAnon.stdout, /Docker is not installed/);
  assert.doesNotMatch(missingAnon.stdout, /Installing dependencies/);

  const missingDb = bash(
    ["scripts/setup.sh"],
    hermeticEnv(bin, {
      CLEAT_ROOT: dir,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-kept",
    }),
  );
  assert.equal(missingDb.status, 1, missingDb.stdout + missingDb.stderr);
  assert.match(missingDb.stdout, /The Supabase URL is set but DATABASE_URL is missing\./);
  assert.match(missingDb.stdout, /Fix: set DATABASE_URL, then run pnpm run setup again\./);
  assert.doesNotMatch(missingDb.stdout, /Starting Supabase/);
  assert.doesNotMatch(missingDb.stdout, /Installing dependencies/);
  assert.equal(existsSync(join(dir, "apps/web/.env.local")), false);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

test("setup stops when the supabase url does not answer", () => {
  const dir = tempRoot();
  const bin = existingStackBin();
  const psqlLog = join(dir, "psql.log");
  writeFileSync(psqlLog, "");
  const result = bash(
    ["scripts/setup.sh"],
    hermeticEnv(bin, {
      CLEAT_ROOT: dir,
      CLEAT_PSQL_LOG: psqlLog,
      CLEAT_PSQL_STATE: join(dir, "psql.state"),
      DATABASE_URL: "postgresql://user:pass@10.9.9.9:5432/app",
      NEXT_PUBLIC_SUPABASE_URL: "https://unreached.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-kept",
    }),
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /The Supabase URL is set but it is not reachable\./);
  assert.match(result.stdout, /Fix: start that project, then run pnpm run setup again\./);
  assert.doesNotMatch(result.stdout, /Installing dependencies/);
  assert.doesNotMatch(result.stdout, /Docker is not installed/);
  assert.doesNotMatch(readFileSync(psqlLog, "utf8"), /FILE:/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});
