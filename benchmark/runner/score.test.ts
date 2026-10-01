import { describe, expect, it } from "vitest";
import type { TLabeledPr } from "./labels";
import { renderResults } from "./report";
import { LINE_TOLERANCE, median, medianScore, type PrRun, scorePr, scoreRun } from "./score";

const pr = (over: Partial<TLabeledPr> = {}): TLabeledPr => ({
  pr: 1,
  kind: "seeded-bug",
  bugs: [{ file: "a.ts", line: 10, note: "missing await" }],
  acceptable: [{ file: "b.ts", line: 4, lineEnd: 6, note: "unhandled error" }],
  ...over,
});
const p = (file: string, line: number, fingerprint = `${file}${line}`) => ({ file, line, fingerprint });
const run = (over: Partial<PrRun> = {}): PrRun => ({
  pr: pr(),
  posted: [],
  reported: [],
  diff: new Map([
    ["a.ts", new Set([9, 10, 11])],
    ["b.ts", new Set([5])],
  ]),
  latencyMs: 1000,
  llmCalls: 2,
  ...over,
});

describe("scorePr", () => {
  it("counts a comment near a bug or acceptable spot as correct", () => {
    const s = scorePr(
      run({ posted: [p("a.ts", 10 + LINE_TOLERANCE), p("b.ts", 5), p("a.ts", 30), p("c.ts", 10)] }),
    );
    expect(s).toMatchObject({ posted: 4, correct: 2 });
  });

  it("recall counts seeded bugs found anywhere, acceptable spots don't count", () => {
    expect(scorePr(run({ reported: [p("a.ts", 11)] }))).toMatchObject({ bugs: 1, found: 1 });
    expect(scorePr(run({ reported: [p("b.ts", 5)] }))).toMatchObject({ found: 0 });
  });

  it("flags comments off the diff and duplicates", () => {
    const s = scorePr(run({ posted: [p("a.ts", 10, "x"), p("a.ts", 11, "x"), p("a.ts", 40)] }));
    expect(s).toMatchObject({ offDiff: 1, duplicates: 1 });
  });

  it("counts every comment on a clean refactor", () => {
    expect(
      scorePr(run({ pr: pr({ kind: "clean-refactor", bugs: [] }), posted: [p("a.ts", 9)] })).cleanComments,
    ).toBe(1);
  });
});

describe("scoreRun / medianScore", () => {
  it("rolls PRs up and keeps re-push numbers only for stack PRs", () => {
    const s = scoreRun([
      run({ posted: [p("a.ts", 10), p("a.ts", 99)], reported: [p("a.ts", 10)], latencyMs: 3000 }),
      run({ pr: pr({ kind: "stack" }), posted: [], latencyMs: 1000, rerun: { posted: 0, llmCalls: 0 } }),
    ]);
    expect(s).toMatchObject({
      precision: 0.5,
      recall: 0.5,
      inlinePerPr: 1,
      offDiff: 1,
      rerunPosted: 0,
      rerunLlmCalls: 0,
      latencyMs: 2000,
    });
  });

  it("precision is n/a when nothing was posted", () => {
    expect(scoreRun([run()]).precision).toBeNull();
    expect(scoreRun([run()]).rerunPosted).toBeNull();
  });

  it("takes the median of each metric across runs", () => {
    const runs = [0.5, 0.9, 0.7].map((precision) => ({ ...scoreRun([run()]), precision }));
    expect(medianScore(runs).precision).toBe(0.7);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("renderResults", () => {
  it("writes the PRD §6 table with one column per reviewer and the method", () => {
    const score = scoreRun([run({ posted: [p("a.ts", 10)], reported: [p("a.ts", 10)] })]);
    const md = renderResults({
      repo: "o/demo",
      prs: 1,
      runs: 3,
      model: "m",
      at: new Date("2026-10-05T00:00:00Z"),
      scores: { sift: score, naive: { ...score, precision: null } },
    });
    expect(md).toContain("| Metric | Target | sift | naive |");
    expect(md).toContain("| Precision (correct / posted) | ≥ 60% | 100% | n/a |");
    expect(md).toContain("committed before any run");
    expect(md).not.toMatch(/[—–]/);
  });
});
