import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mockModel } from "@sift/ai/mock";
import type { TCategory, TModelFinding, TReviewResult } from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";
import { describe, expect, it } from "vitest";
import type { PrFile } from "../diff/diff-map";
import type { PrComment } from "../feedback/collect";
import { createIngest, type Ingest } from "../ingest/client";
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

describe("impact analysis (feature flag)", () => {
  const CART = [
    "export class Cart {",
    "  items: number[] = [];",
    "  async getTotal(): Promise<number> {",
    "    return this.items.reduce((a, b) => a + b, 0);",
    "  }",
    "}",
  ];
  const CART_PATCH = [
    "@@ -1,5 +1,5 @@",
    " export class Cart {",
    "   items: number[] = [];",
    "-  getTotal(): number {",
    "+  async getTotal(): Promise<number> {",
    "     return this.items.reduce((a, b) => a + b, 0);",
    "   }",
  ].join("\n");
  const files: PrFile[] = [{ filename: "src/cart.ts", status: "modified", patch: CART_PATCH }];
  const ws = () =>
    workspace({
      "tsconfig.json": ['{ "compilerOptions": { "strict": true }, "include": ["src"] }'],
      "src/cart.ts": CART,
      "src/checkout.ts": ['import { Cart } from "./cart";', "export const t = (c: Cart) => c.getTotal();"],
    });
  const go = (features?: ReadonlySet<string>) => {
    const { gh, reviews } = fakeGitHub(files);
    const reviewModel = reviewModelByFile({ "src/cart.ts": reviewJson([]) });
    const result = runPrReview(
      { event: prEvent(), workspace: ws() },
      { gh, reviewModel, judgeModel: mockModel([judgeJson([])]), features },
    );
    return { result, reviews, reviewModel };
  };

  it("lists callers outside the diff, tells the model, and rates a changed signature high", async () => {
    const { result, reviews, reviewModel } = go(new Set(["impact"]));
    const r = await result;
    expect(r.impact).toEqual([{ symbol: "Cart.getTotal", file: "src/checkout.ts", line: 2 }]);
    expect(r.riskTier).toBe("high");
    expect(JSON.stringify(reviewModel.doGenerateCalls[0]?.prompt)).toContain(
      "Cart.getTotal is used at src/checkout.ts:2",
    );
    expect(reviews[0]?.body).toContain("`Cart.getTotal` used at `src/checkout.ts:2`");
  });

  it("does nothing without the flag", async () => {
    const r = await go().result;
    expect(r.impact).toEqual([]);
    expect(r.riskTier).toBe("low");
  });

  it("a broken project never fails the review", async () => {
    const { gh } = fakeGitHub(files);
    const dir = workspace({ "tsconfig.json": ["{ not json"], "src/cart.ts": CART });
    const r = await runPrReview(
      { event: prEvent(), workspace: dir },
      {
        gh,
        reviewModel: reviewModelByFile({ "src/cart.ts": reviewJson([]) }),
        judgeModel: mockModel([judgeJson([])]),
        features: new Set(["impact"]),
      },
    );
    expect(r.impact).toEqual([]);
  });
});

describe("stack awareness (feature flag)", () => {
  const features = new Set(["stack"]);
  // The event's PR is #12 (head ref + base ref come from the fixture); build a stack around it.
  const stackOf = () => {
    const ev = prEvent().pull_request;
    return [
      { number: 11, title: "lower", headRef: ev.base.ref, baseRef: "main", labels: ["sift:risk-low"] },
      { number: 12, title: ev.title, headRef: ev.head.ref, baseRef: ev.base.ref, labels: [] },
      { number: 13, title: "upper", headRef: "upper", baseRef: ev.head.ref, labels: ["sift:risk-high"] },
    ];
  };
  const marker = `<!-- sift:patch=${"a".repeat(40)} -->`;
  const go = (opts: {
    patchId: string | null;
    postedByPr?: Record<number, string[]>;
    features?: ReadonlySet<string>;
  }) => {
    const { gh, reviews, labels } = fakeGitHub(prFiles, { openPrs: stackOf(), postedByPr: opts.postedByPr });
    const reviewModel = reviewModelByFile({ "src/checkout.ts": reviewJson([onDiffBug]) });
    const result = runPrReview(
      {
        event: prEvent(),
        workspace: workspace({ "src/checkout.ts": CHECKOUT, "src/broken.ts": ["a", "b"] }),
      },
      {
        gh,
        reviewModel,
        judgeModel: mockModel([judgeJson([[onDiffBug, 0.95]])]),
        features: opts.features ?? features,
        patchId: () => opts.patchId,
      },
    );
    return { result, reviews, labels, reviewModel };
  };

  it("skips an unchanged layer: 0 LLM calls, nothing posted, label untouched", async () => {
    const { result, reviews, labels, reviewModel } = go({
      patchId: "a".repeat(40),
      postedByPr: { 12: [`### Sift review\n${marker}`] },
    });
    const r = await result;
    expect(r.stats).toMatchObject({ llmCalls: 0, skippedReason: "unchanged-layer" });
    expect(reviewModel.doGenerateCalls).toHaveLength(0);
    expect(reviews).toEqual([]);
    expect(labels.size).toBe(0);
  });

  it("reviews when the layer's own patch changed, and records the new patch-id", async () => {
    const { result, reviews } = go({ patchId: "b".repeat(40), postedByPr: { 12: [marker] } });
    expect((await result).stats.skippedReason).toBeUndefined();
    expect(reviews[0]?.body).toContain(`<!-- sift:patch=${"b".repeat(40)} -->`);
  });

  it("shows the stack risk map, bottom to top, marking this PR", async () => {
    const { result, reviews } = go({ patchId: "b".repeat(40) });
    const r = await result;
    expect(r.stack?.map((l) => [l.prNumber, l.riskTier, l.skipped])).toEqual([
      [11, "low", false],
      [12, "high", false],
      [13, "high", false],
    ]);
    expect(reviews[0]?.body).toContain("#### Stack (bottom to top)");
    expect(reviews[0]?.body).toMatch(/- #12 .* ← this PR/);
  });

  it("doesn't repeat a finding another layer of the stack already posted", async () => {
    const posted = { 13: [`earlier comment\n${`<!-- sift:fp=${fingerprint(onDiffBug)} -->`}`] };
    const { result } = go({ patchId: "b".repeat(40), postedByPr: posted });
    const r = await result;
    expect(r.inline).toEqual([]);
    expect(r.riskTier).toBe("high"); // risk still counts it
  });

  it("without the flag nothing about stacks happens", async () => {
    const { result } = go({ patchId: "a".repeat(40), postedByPr: { 12: [marker] }, features: new Set() });
    const r = await result;
    expect(r.stack).toBeUndefined();
    expect(r.stats.skippedReason).toBeUndefined();
  });
});

describe("dashboard API (ingest) and feedback", () => {
  function recordingIngest(opts: { muted?: TCategory[]; down?: boolean } = {}) {
    const calls: string[] = [];
    const sent: { review?: TReviewResult; feedback: unknown[] } = { feedback: [] };
    const ingest: Ingest = {
      reviewStarted: async () => {
        calls.push("review-started");
      },
      config: async () => {
        calls.push("config");
        return opts.muted ?? [];
      },
      feedback: async (events) => {
        calls.push("feedback");
        sent.feedback.push(...events);
      },
      review: async (r) => {
        calls.push("review");
        sent.review = r;
      },
    };
    return { ingest, calls, sent };
  }
  const priorComment: PrComment = {
    id: 1,
    body: `old\n<!-- sift:fp=${"a".repeat(12)} -->`,
    line: null, // the line has changed since: the author fixed it
    inReplyTo: null,
    author: "github-actions[bot]",
    isBot: true,
    reactions: { up: 0, down: 0 },
  };
  const go = (ingest: Ingest, features = new Set(["feedback"])) => {
    const { gh, reviews } = fakeGitHub(prFiles, { comments: [priorComment] });
    const result = runPrReview(
      {
        event: prEvent(),
        workspace: workspace({ "src/checkout.ts": CHECKOUT, "src/broken.ts": ["a", "b"] }),
      },
      {
        gh,
        reviewModel: reviewModelByFile({ "src/checkout.ts": reviewJson([onDiffBug, nit]) }),
        judgeModel: mockModel([judgeJson([[onDiffBug, 0.95]])]),
        features,
        ingest,
      },
    );
    return { result, reviews };
  };

  it("reports in TRD §8 order: started, config, feedback, then the result after posting", async () => {
    const { ingest, calls, sent } = recordingIngest();
    const { result, reviews } = go(ingest);
    const r = await result;
    expect(calls).toEqual(["review-started", "config", "feedback", "review"]);
    expect(reviews).toHaveLength(1);
    expect(sent.review).toEqual(r);
    expect(sent.feedback).toEqual([
      expect.objectContaining({
        repo: "ydvSajal/sift-demo-shop",
        prNumber: 12,
        fingerprint: "a".repeat(12),
        outcome: "accepted",
        source: "line-changed",
      }),
    ]);
  });

  it("skips feedback collection without the flag", async () => {
    const { ingest, calls } = recordingIngest();
    await go(ingest, new Set()).result;
    expect(calls).toEqual(["review-started", "config", "review"]);
  });

  it("drops low/nit findings of a muted category", async () => {
    const { ingest } = recordingIngest({ muted: ["style"] });
    const r = await go(ingest).result;
    expect([...r.inline, ...r.summarized].map((f) => f.ruleKey)).toEqual(["missing-await"]);
  });

  it("API down → the review still posts", async () => {
    const down = createIngest("http://127.0.0.1:9", "s", (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch);
    const { result, reviews } = go(down);
    await expect(result).resolves.toMatchObject({ prNumber: 12 });
    expect(reviews).toHaveLength(1);
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
