import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const FORBIDDEN = ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE"];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const PACKAGE_INDEX: Record<string, string> = {
  "@cleat/ai": "packages/ai/src/index.ts",
  "@cleat/api": "packages/api/src/index.ts",
  "@cleat/domain": "packages/domain/src/index.ts",
  "@cleat/theme": "packages/theme/src/index.ts",
  "@cleat/db": "packages/db/src/index.ts",
};

function walkFiles(dir: string, skip: (path: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (skip(path)) continue;
    const info = statSync(path);
    if (info.isDirectory()) found.push(...walkFiles(path, skip));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) found.push(path);
  }
  return found;
}

function resolveImport(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith("@cleat/")) {
    const [name, sub] = specifier.split("/").reduce(
      (acc, part, index) => {
        if (index < 2) acc[0] = `${acc[0]}${index === 0 ? "" : "/"}${part}`;
        else acc[1] = `${acc[1]}${acc[1] ? "/" : ""}${part}`;
        return acc;
      },
      ["", ""],
    );
    if (sub) {
      const base = join(ROOT, "packages", name.replace("@cleat/", ""), "src", sub);
      for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) {
        const candidate = `${base}${suffix}`;
        try {
          if (statSync(candidate).isFile()) return candidate;
        } catch {
          // try the next suffix
        }
      }
      return null;
    }
    const index = PACKAGE_INDEX[name];
    return index ? join(ROOT, index) : null;
  }
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const suffix of ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]) {
    const candidate = `${base}${suffix}`;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next suffix
    }
  }
  return null;
}

function importedSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const pattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) specs.push(specifier);
  }
  return specs;
}

function collectGraph(starts: string[]): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [...starts];
  while (queue.length > 0) {
    const path = queue.pop();
    if (!path || files.has(path)) continue;
    let source = "";
    try {
      source = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    files.set(path, source);
    for (const specifier of importedSpecifiers(source)) {
      const next = resolveImport(specifier, path);
      if (next && !files.has(next)) queue.push(next);
    }
  }
  return files;
}

function assertClean(label: string, files: Map<string, string>) {
  const bundle = [...files.values()].join("\n");
  for (const secret of FORBIDDEN) {
    assert.equal(bundle.includes(secret), false, `${label} contains ${secret}`);
  }
  assert.ok(files.size > 0, `${label} bundle is empty`);
}

function grepTree(dir: string): string[] {
  const hits: string[] = [];
  let entries: string[] = [];
  try {
    entries = walkFiles(dir, () => false);
  } catch {
    return hits;
  }
  for (const path of entries) {
    if (!path.endsWith(".js")) continue;
    const source = readFileSync(path, "utf8");
    for (const secret of FORBIDDEN) {
      if (source.includes(secret)) hits.push(`${path} contains ${secret}`);
    }
  }
  return hits;
}

test("expo and client web bundles do not contain server secrets", () => {
  const mobileStarts = walkFiles(join(ROOT, "apps/mobile"), (path) => path.includes("node_modules"));
  const webClientStarts = walkFiles(join(ROOT, "apps/web"), (path) => {
    return (
      path.includes("node_modules") ||
      path.includes(`${join("app", "api")}`) ||
      path.includes(`${join("lib", "server")}`) ||
      path.includes(".next")
    );
  }).filter((path) => {
    const source = readFileSync(path, "utf8");
    return source.includes("use client") || path.includes(`${join("apps", "web", "app")}`);
  });

  const mobile = collectGraph(mobileStarts);
  const web = collectGraph(
    webClientStarts.filter((path) => readFileSync(path, "utf8").includes("use client")),
  );
  assertClean("expo", mobile);
  assertClean("client web", web);

  for (const built of [
    join(ROOT, "apps/web/.next/static"),
    join(ROOT, "apps/mobile/dist"),
    join(ROOT, "apps/mobile/web-build"),
  ]) {
    const hits = grepTree(built);
    assert.deepEqual(hits, [], hits.join("\n"));
  }
});
