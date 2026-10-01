import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mockModel } from "@sift/ai/mock";
import type { TModelFinding } from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";
import { describe, expect, it } from "vitest";
import type { PrFile } from "../diff/diff-map";
import { fakeGitHub, prEvent } from "../testing";
import { runPrReview } from "./run";

// ---- A small PR: checkout.ts gains two lines (6 and 7) --------------------------------------
const CHECKOUT = [
  'import { charge } from "./payments";', // 1
  'import { log } from "./log";', // 2
  "", // 3
  "export async function checkout(cart: Cart, user: User) {", // 4
  "  const d = new Date();", // 5
  "  const total = cart.getTotal();", // 6 (added)
  "  log(`checkout ${user.id} at ${d.toISOString()}`);", // 7 (added)
  '  if (total <= 0) throw new Error("Empty cart");', // 8
  "  return charge(user, total);", // 9
  "}", // 10
];
const CHECKOUT_PATCH = [
  "@@ -3,7 +3,8 @@",
  " ",
  " export async function checkout(cart: Cart, user: User) {",
  "   const d = new Date();",
  "-  const total = cart.getTotal();",
  "+  const total = cart.getTotal();",
  "+  log(`checkout ${user.id} at ${d.toISOString()}`);",
  '   if (total <= 0) throw new Error("Empty cart");',
  "   return charge(user, total);",
  " }",
].join("\n");

const f = (over: Partial<TModelFinding> & Pick<TModelFinding, "line" | "quotedCode">): TModelFinding => ({
  file: "src/checkout.ts",
  severity: "high",
  category: "bug",
  ruleKey: "generic-bug",
  title: "A bug",
  body: "Explained.",
  confidence: 0.9,
  ...over,
});

const onDiffBug = f({
  line: 6,
  severity: "critical",
  ruleKey: "missing-await",
  title: "`getTotal()` isn't awaited",
  suggestion: "const total = await cart.getTotal();",
  quotedCode: "const total = cart.getTotal();",
});
const offDiff = f({
  line: 9,
  severity: "medium",
  category: "error-handling",
  ruleKey: "unhandled-charge",
  title: "`charge` failure isn't handled",
  quotedCode: "return charge(user, total);",
  confidence: 0.8,
});
const madeUp = f({ line: 6, ruleKey: "invented", quotedCode: "const total = await cart.getTotal();" });
const nit = f({
  line: 7,
  severity: "nit",
  category: "style",
  ruleKey: "log-format",
  title: "Log format nit",
  quotedCode: "log(`checkout ${user.id}",
  confidence: 0.7,
});
const unsure = f({ line: 7, severity: "low", ruleKey: "pii-in-log", quotedCode: "user.id", confidence: 0.4 });

const reviewJson = (findings: TModelFinding[]) =>
  JSON.stringify({
    whatChanged: "Checkout now logs a timestamp.",
    findings: findings.map(({ file: _file, ...rest }) => rest),
  });
const judgeJson = (scores: [TModelFinding, number][]) =>
  JSON.stringify({
    scores: scores.map(([finding, confidence]) => ({ fingerprint: fingerprint(finding), confidence })),
  });

// ---- Harness --------------------------------------------------------------------------------
function workspace(files: Record<string, string[]>): string {
  const dir = mkdtempSync(join(tmpdir(), "sift-ws-"));
  for (const [path, lines] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${lines.join("\n")}\n`);
  }
  return dir;
}

/** Review model that answers per file (files are reviewed concurrently). */
function reviewModelByFile(answers: Record<string, string | Error>) {
  return mockModel((prompt) => {
    for (const [file, answer] of Object.entries(answers)) {
      if (prompt.includes(`File: ${file}`)) {
        if (answer instanceof Error) throw answer;
        return answer;
      }
    }
    return reviewJson([]);
  });
}

const prFiles: PrFile[] = [
  { filename: "src/checkout.ts", status: "modified", patch: CHECKOUT_PATCH },
  { filename: "src/broken.ts", status: "modified", patch: "@@ -1,1 +1,2 @@\n a\n+b" },
  { filename: "src/ghost.ts", status: "added", patch: "@@ -0,0 +1,1 @@\n+x" },
  { filename: "pnpm-lock.yaml", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" },
  { filename: "public/logo.png", status: "added" },
  { filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" },
  { filename: "src/old.ts", status: "removed", patch: "@@ -1 +0,0 @@\n-a" },
];

async function run(opts: {
  files?: PrFile[];
  ws?: Record<string, string[]>;
  review?: Record<string, string | Error>;
  judge?: string;
  failReviews?: { times: number; status: number };
}) {
  const { gh, reviews } = fakeGitHub(opts.files ?? prFiles, { failReviews: opts.failReviews });
  const reviewModel = reviewModelByFile(
    opts.review ?? {
      "src/checkout.ts": reviewJson([onDiffBug, offDiff, madeUp, nit, unsure]),
      "src/broken.ts": new Error("503 model overloaded"),
    },
  );
  const judgeModel = mockModel([opts.judge ?? judgeJson([[onDiffBug, 0.95]])]);
  const ws = workspace(opts.ws ?? { "src/checkout.ts": CHECKOUT, "src/broken.ts": ["a", "b"] });
  const result = await runPrReview({ event: prEvent(), workspace: ws }, { gh, reviewModel, judgeModel });
  return { result, reviews, reviewModel, judgeModel };
}

// ---- Tests ------------------------------------------------------------------------------------
describe("runPrReview end to end (fake GitHub + mock models)", () => {
  it("posts exactly one COMMENT review pinned to the head commit", async () => {
    const { reviews } = await run({});
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.event).toBe("COMMENT");
    expect(reviews[0]?.commit_id).toBe(prEvent().pull_request.head.sha);
  });

  it("comments inline only on the grounded, on-diff finding", async () => {
    const { reviews } = await run({});
    const comments = reviews[0]?.comments ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ path: "src/checkout.ts", line: 6, side: "RIGHT" });
    expect(comments[0]?.body).toContain("`getTotal()` isn't awaited");
    expect(comments[0]?.body).toContain("const total = await cart.getTotal();");
    expect(comments[0]?.body).toContain(`<!-- sift:fp=${fingerprint(onDiffBug)} -->`);
  });

  it("moves real off-diff findings and nits to the summary, ranked", async () => {
    const { result, reviews } = await run({});
    expect(result.summarized.map((x) => x.ruleKey)).toEqual(["unhandled-charge", "log-format"]);
    expect(reviews[0]?.body).toContain("`src/checkout.ts:9` — `charge` failure isn't handled");
    expect(reviews[0]?.body).toContain("Log format nit");
  });

  it("drops made-up quotes and findings below the confidence floor", async () => {
    const { result } = await run({});
    const all = [...result.inline, ...result.summarized].map((x) => x.ruleKey);
    expect(all).not.toContain("invented");
    expect(all).not.toContain("pii-in-log");
    expect(result.droppedCount).toBe(2);
  });

  it("applies the judge's confidence", async () => {
    const { result } = await run({});
    expect(result.inline[0]?.confidence).toBe(0.95);
  });

  it("lists every file it didn't review, with a reason, and keeps going", async () => {
    const { result, reviews } = await run({});
    expect(Object.fromEntries(result.skippedFiles.map((s) => [s.file, s.reason]))).toEqual({
      "pnpm-lock.yaml": "generated, vendored or binary",
      "public/logo.png": "generated, vendored or binary",
      "README.md": "not TypeScript/JavaScript",
      "src/ghost.ts": "not found in the checkout",
      "src/broken.ts": "review failed: 503 model overloaded",
    });
    expect(reviews[0]?.body).toContain("`src/broken.ts`: review failed");
  });

  it("fills the ReviewResult contract", async () => {
    const { result } = await run({});
    expect(result).toMatchObject({
      mode: "pr",
      repo: "ydvSajal/sift-demo-shop",
      prNumber: 12,
      prTitle: "make getTotal async",
      author: "demo-author",
      requestedReviewers: ["senior-a", "senior-b"],
      riskTier: "high",
      whatChanged: "Checkout now logs a timestamp.",
    });
    expect(result.stats.llmCalls).toBe(3); // checkout + broken (failed) + one judge batch
  });

  it("shows the model only +/-20 lines of real code around the change, with added lines marked", async () => {
    const { reviewModel } = await run({ files: [prFiles[0] as PrFile] });
    const prompt = JSON.stringify(reviewModel.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain(" 6+ |   const total = cart.getTotal();");
    expect(prompt).toContain(" 5  |   const d = new Date();");
  });

  it("drops a finding the judge rates below the floor", async () => {
    const { result } = await run({ judge: judgeJson([[onDiffBug, 0.2]]) });
    expect(result.inline).toEqual([]);
    expect(result.riskTier).toBe("medium"); // only the medium off-diff finding is left
  });

  it("keeps original confidences when the judge fails", async () => {
    const { result } = await run({ judge: "{broken" });
    expect(result.inline[0]?.confidence).toBe(0.9);
  });

  it("caps inline comments at 7 and never inlines a nit", async () => {
    const body = Array.from({ length: 10 }, (_, i) => `const v${i} = compute(${i});`);
    const patch = `@@ -0,0 +1,10 @@\n${body.map((l) => `+${l}`).join("\n")}`;
    const findings = body.map((l, i) =>
      f({
        file: "src/many.ts",
        line: i + 1,
        quotedCode: l,
        ruleKey: `bug-${i}`,
        severity: i === 0 ? "nit" : "high",
      }),
    );
    const { result, reviews } = await run({
      files: [{ filename: "src/many.ts", status: "added", patch }],
      ws: { "src/many.ts": body },
      review: { "src/many.ts": reviewJson(findings) },
      judge: judgeJson([]),
    });
    expect(reviews[0]?.comments).toHaveLength(7);
    expect(result.inline.every((x) => x.severity !== "nit")).toBe(true);
    expect(result.summarized).toHaveLength(3);
  });

  it("posts one comment when the model repeats the same finding", async () => {
    const { result } = await run({
      review: { "src/checkout.ts": reviewJson([onDiffBug, { ...onDiffBug, line: 7 }]) },
    });
    expect(result.inline).toHaveLength(1);
    expect(result.droppedCount).toBe(0); // folded into one comment, not discarded
  });

  it("lists a file whose model output is unreadable twice as skipped", async () => {
    const { result } = await run({ review: { "src/checkout.ts": "{nope" } });
    expect(result.skippedFiles).toContainEqual({
      file: "src/checkout.ts",
      reason: "model output unreadable twice",
    });
  });

  it("refuses PR paths that escape the checkout", async () => {
    const { result } = await run({
      files: [{ filename: "../outside.ts", status: "added", patch: "@@ -0,0 +1 @@\n+x" }],
    });
    expect(result.skippedFiles).toEqual([{ file: "../outside.ts", reason: "not found in the checkout" }]);
  });

  it("still posts when nothing was reviewable", async () => {
    const { result, reviews } = await run({
      files: [{ filename: "docs/a.md", status: "added", patch: "+x" }],
    });
    expect(reviews).toHaveLength(1);
    expect(result).toMatchObject({ inline: [], summarized: [], riskTier: "low" });
    expect(result.stats.llmCalls).toBe(0);
  });
});

describe("re-push (dedupe across pushes)", () => {
  async function pushTwice(second?: { review: string }) {
    const { gh, reviews } = fakeGitHub(prFiles);
    const ws = workspace({ "src/checkout.ts": CHECKOUT, "src/broken.ts": ["a", "b"] });
    const answer = reviewJson([onDiffBug, offDiff, nit]);
    const push = (review: string) =>
      runPrReview(
        { event: prEvent(), workspace: ws },
        {
          gh,
          reviewModel: reviewModelByFile({ "src/checkout.ts": review, "src/broken.ts": reviewJson([]) }),
          judgeModel: mockModel([judgeJson([[onDiffBug, 0.95]])]),
        },
      );
    await push(answer);
    const result = await push(second?.review ?? answer);
    return { result, reviews };
  }

  it("posts 0 repeats: the same findings on the next push produce no new review", async () => {
    const { result, reviews } = await pushTwice();
    expect(reviews).toHaveLength(1);
    expect(result.inline).toEqual([]);
    expect(result.summarized).toEqual([]);
  });

  it("still posts what is new on a later push, without the old findings", async () => {
    const fresh = f({
      line: 8,
      severity: "high",
      ruleKey: "throws-empty",
      title: "Throws on empty cart",
      quotedCode: 'throw new Error("Empty cart");',
    });
    const { result, reviews } = await pushTwice({ review: reviewJson([onDiffBug, offDiff, nit, fresh]) });
    expect(reviews).toHaveLength(2);
    expect(result.summarized.map((x) => x.ruleKey)).toEqual(["throws-empty"]);
    expect(reviews[1]?.comments).toEqual([]);
    expect(reviews[1]?.body).not.toContain("isn't awaited");
  });
});

describe("readFile seam (no filesystem)", () => {
  it("reviews from an in-memory reader, with no workspace", async () => {
    const { gh, reviews } = fakeGitHub(prFiles);
    const reads: string[] = [];
    const result = await runPrReview(
      { event: prEvent() },
      {
        gh,
        readFile: async (path) => {
          reads.push(path);
          return path === "src/checkout.ts" ? CHECKOUT : null;
        },
        reviewModel: reviewModelByFile({ "src/checkout.ts": reviewJson([onDiffBug]) }),
        judgeModel: mockModel([judgeJson([[onDiffBug, 0.95]])]),
      },
    );
    expect(result.inline.map((x) => x.ruleKey)).toEqual(["missing-await"]);
    expect(reviews[0]?.comments).toHaveLength(1);
    expect(reads).toContain("src/checkout.ts");
    expect(result.skippedFiles).toContainEqual({ file: "src/ghost.ts", reason: "not found in the checkout" });
  });

  it("fails clearly when given neither a workspace nor a reader", async () => {
    await expect(runPrReview({ event: prEvent() }, { gh: fakeGitHub(prFiles).gh })).rejects.toThrow(
      "workspace or a readFile",
    );
  });
});

describe("risk label", () => {
  const stale = ["sift:risk-low", "sift:risk-medium", "bug"];
  const labelled = (opts: { labels?: string[]; failLabels?: boolean }, review = reviewJson([onDiffBug])) => {
    const { gh, labels } = fakeGitHub(prFiles, opts);
    const ws = workspace({ "src/checkout.ts": CHECKOUT, "src/broken.ts": ["a", "b"] });
    const reviewModel = reviewModelByFile({ "src/checkout.ts": review });
    const judgeModel = mockModel([judgeJson([[onDiffBug, 0.95]])]);
    const result = runPrReview({ event: prEvent(), workspace: ws }, { gh, reviewModel, judgeModel });
    return { result, labels, gh, ws, reviewModel };
  };

  it("sets exactly one sift:risk-* label, removes the stale ones, leaves others alone", async () => {
    const { result, labels } = labelled({ labels: stale });
    expect((await result).riskTier).toBe("high");
    expect([...labels].sort()).toEqual(["bug", "sift:risk-high"]);
  });

  it("moves the label down when a later push has no findings", async () => {
    const { result, labels } = labelled({ labels: ["sift:risk-high"] }, reviewJson([]));
    expect((await result).riskTier).toBe("low");
    expect([...labels]).toEqual(["sift:risk-low"]);
  });

  it("keeps the label high on a re-push whose findings were all posted before", async () => {
    const { gh, ws, result: first } = labelled({});
    await first;
    const second = await runPrReview(
      { event: prEvent(), workspace: ws },
      {
        gh,
        reviewModel: reviewModelByFile({ "src/checkout.ts": reviewJson([onDiffBug]) }),
        judgeModel: mockModel([judgeJson([[onDiffBug, 0.95]])]),
      },
    );
    expect(second.inline).toEqual([]);
    expect(second.riskTier).toBe("high");
  });

  it("a label failure doesn't fail the review", async () => {
    const { result } = labelled({ failLabels: true });
    await expect(result).resolves.toMatchObject({ riskTier: "high" });
  });
});

describe("posting fallback", () => {
  it("reposts everything in the summary if GitHub rejects an inline line (422)", async () => {
    const { reviews } = await run({ failReviews: { times: 1, status: 422 } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.comments).toEqual([]);
    expect(reviews[0]?.body).toContain("#### Top findings");
    expect(reviews[0]?.body).toContain("`getTotal()` isn't awaited");
  });

  it("surfaces other GitHub errors", async () => {
    await expect(run({ failReviews: { times: 1, status: 500 } })).rejects.toThrow();
  });
});
