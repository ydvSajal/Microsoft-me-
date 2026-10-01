#!/usr/bin/env node
// sift review <file> [--json] — single-file review (FR-01). Logic lives in result.ts / format.ts.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseArgs } from "node:util";
import { buildFileResult, ProviderConfigError, REVIEWABLE_FILE, reviewHunks } from "@sift/ai";
import { formatResult } from "./format";

const USAGE = "Usage: pnpm sift review <file.ts|.tsx|.js|.jsx> [--json]";

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function main() {
  try {
    process.loadEnvFile(); // optional .env in the working directory
  } catch {}

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } },
  });
  const [command, path] = positionals;
  if (values.help) fail(USAGE, 0);
  if (command !== "review" || !path) fail(USAGE, 2);
  if (!REVIEWABLE_FILE.test(path)) fail(`Sift reviews TypeScript/JavaScript files only: ${path}`, 2);

  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    fail(`Can't read ${path}`);
  }
  const lines = source.replace(/\r?\n$/, "").split(/\r?\n/);
  const file = relative(process.cwd(), path).split("\\").join("/");

  const started = performance.now();
  try {
    const out = await reviewHunks({ file, hunks: [{ startLine: 1, lines }] });
    const result = buildFileResult(out, performance.now() - started);
    process.stdout.write(
      values.json ? `${JSON.stringify(result, null, 2)}\n` : formatResult(file, result, process.stdout.isTTY),
    );
  } catch (err) {
    if (err instanceof ProviderConfigError)
      fail(`${err.message}\nCopy .env.example to .env and fill in the AI layer.`);
    fail(`Review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

await main();
