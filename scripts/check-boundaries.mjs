#!/usr/bin/env node
// Enforces package boundaries from docs/ARCHITECTURE.md §3. Run via `pnpm check:boundaries`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", ".pio"]);
const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

const isRelative = (spec) => spec.startsWith(".") || spec.startsWith("/");
const isBuiltin = (spec) => spec.startsWith("node:");

/** Each rule applies to every source file under `dir`. */
const RULES = [
  {
    dir: "packages/shared",
    check: (spec) => isRelative(spec) || isBuiltin(spec) || spec === "zod",
    why: "@sift/shared may import only zod",
  },
  {
    dir: "packages/ai",
    check: (spec) =>
      !/^@sift\/core(\/|$)/.test(spec) && !/^@octokit\//.test(spec) && !/^@prisma\//.test(spec),
    why: "@sift/ai must not import the pipeline, GitHub or the DB",
  },
  {
    dir: "packages/core",
    check: (spec) => !/^@prisma\//.test(spec),
    why: "@sift/core must not touch the database (use the ingest API)",
  },
  {
    dir: "apps/cli",
    check: (spec) => !/^@sift\/core(\/|$)/.test(spec),
    why: "the CLI must not import @sift/core",
  },
  {
    dir: "apps/web",
    check: (spec) => !/^@sift\/core(\/|$)/.test(spec),
    why: "apps/web must not import @sift/core (keeps ts-morph/Octokit out of the Vercel bundle)",
  },
];

// Provider SDKs are allowed in exactly one file.
const PROVIDER_FILE = "packages/ai/src/provider.ts";
const PROVIDER_SDK = /^@ai-sdk\//;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(name)) out.push(full);
  }
  return out;
}

function importsOf(file) {
  const src = readFileSync(file, "utf8");
  const specs = [];
  for (const m of src.matchAll(IMPORT_RE)) specs.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return specs.filter(Boolean);
}

const violations = [];

for (const rule of RULES) {
  const dir = join(ROOT, rule.dir);
  if (!existsSync(dir)) continue; // package not created yet
  for (const file of walk(dir)) {
    for (const spec of importsOf(file)) {
      // Tests may import the test runner from any package.
      if (spec !== "vitest" && !rule.check(spec))
        violations.push(`${relative(ROOT, file)} imports "${spec}" — ${rule.why}`);
    }
  }
}

for (const top of ["packages", "apps"]) {
  const dir = join(ROOT, top);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (rel === PROVIDER_FILE) continue;
    for (const spec of importsOf(file)) {
      if (PROVIDER_SDK.test(spec))
        violations.push(`${rel} imports "${spec}" — provider SDKs belong only in ${PROVIDER_FILE}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`Package boundary violations (${violations.length}):\n  - ${violations.join("\n  - ")}`);
  process.exit(1);
}
console.log("Package boundaries OK");
