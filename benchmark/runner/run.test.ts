// The whole benchmark offline: real Sift pipeline and naive baseline on mock models, a temp git
// repo with one seeded bug, nothing posted anywhere.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mockModel } from "@sift/ai/mock";
import { gitPatchId, PrEvent } from "@sift/core";
import { fingerprint } from "@sift/shared/fingerprint";
import { describe, expect, it } from "vitest";
import type { TLabels } from "./labels";
import { naiveReviewer, siftReviewer } from "./reviewers";
import { benchmark } from "./run";

const dir = mkdtempSync(join(tmpdir(), "sift-bench-test-"));
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};
const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, env }).toString().trim();
const BASE = ["export function checkout(cart: Cart) {", "  return cart.total;", "}"];
const HEAD = [
  "export async function checkout(cart: Cart) {",
  "  const total = cart.getTotal();",
  "  if (total <= 0) throw new Error();",
  "  return total;",
  "}",
];
git("init", "-q", "-b", "main");
writeFileSync(join(dir, "checkout.ts"), `${BASE.join("\n")}\n`);
git("add", "-A");
git("commit", "-qm", "base");
const baseSha = git("rev-parse", "HEAD");
git("checkout", "-qb", "pr");
writeFileSync(join(dir, "checkout.ts"), `${HEAD.join("\n")}\n`);
git("commit", "-qam", "pr");
const headSha = git("rev-parse", "HEAD");

const patch = [
  "@@ -1,3 +1,5 @@",
  ...HEAD.slice(0, 4).map((l) => `+${l}`),
  ...BASE.slice(0, 2).map((l) => `-${l}`),
  " }",
].join("\n");
const event = PrEvent.parse({
  pull_request: {
    number: 7,
    title: "async checkout",
    user: { login: "a" },
    head: { sha: headSha, ref: "pr", repo: { full_name: "o/demo" } },
    base: { sha: baseSha, ref: "main", repo: { full_name: "o/demo" } },
  },
  repository: { name: "demo", owner: { login: "o" } },
});

const bug = {
  line: 2,
  severity: "critical",
  category: "bug",
  ruleKey: "missing-await",
  title: "Not awaited",
  body: "b",
  quotedCode: "const total = cart.getTotal();",
  confidence: 0.9,
};
const noise = { ...bug, line: 40, ruleKey: "invented", quotedCode: "nothing like this", confidence: 0.5 };
const answer = JSON.stringify({ whatChanged: "x", findings: [bug, bug, noise] });
const models = () => ({
  reviewModel: mockModel([answer]),
  judgeModel: mockModel([
    JSON.stringify({
      scores: [{ fingerprint: fingerprint(bug), confidence: 0.95 }],
    }),
  ]),
});

const labels: TLabels = {
  repo: "o/demo",
  prs: [
    { pr: 7, kind: "stack", bugs: [{ file: "checkout.ts", line: 2, note: "missing await" }], acceptable: [] },
  ],
};

describe("benchmark (offline)", () => {
  it("scores Sift above the naive baseline on the same model output", async () => {
    const scores = await benchmark({
      labels,
      reviewers: [siftReviewer(models(), gitPatchId), naiveReviewer(models())],
      runs: 2,
      prepare: async () => ({
        event,
        workspace: dir,
        files: [{ filename: "checkout.ts", status: "modified", patch }],
      }),
    });
    expect(scores.sift).toMatchObject({
      precision: 1,
      recall: 1,
      inlinePerPr: 1,
      offDiff: 0,
      duplicates: 0,
      rerunPosted: 0,
      rerunLlmCalls: 0,
    });
    expect(scores.naive).toMatchObject({ recall: 1, offDiff: 1, duplicates: 1, rerunPosted: 3 });
    expect(scores.naive?.precision).toBeCloseTo(2 / 3);
    expect(scores.naive?.rerunLlmCalls).toBeGreaterThan(0);
  });
});
