import { readFileSync } from "node:fs";
import { ReviewResult } from "@sift/shared";
import { describe, expect, it } from "vitest";
import { reviewRow, splitRepo, statDelta } from "./ingest";

const pr = ReviewResult.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/shared/src/fixtures/review-result-pr.json", import.meta.url),
      "utf8",
    ),
  ),
);

describe("splitRepo", () => {
  it.each([
    ["ydvSajal/sift-demo-shop", { owner: "ydvSajal", name: "sift-demo-shop" }],
    ["a.b/c_d", { owner: "a.b", name: "c_d" }],
    ["nope", null],
    ["a/b/c", null],
    ["../etc", null],
  ])("%s", (full, want) => expect(splitRepo(full)).toEqual(want));
});

describe("reviewRow", () => {
  it("maps a ReviewResult to the Review row with placed findings", () => {
    const row = reviewRow(pr);
    expect(row).toMatchObject({
      headSha: pr.headSha,
      riskTier: "HIGH",
      inlineCount: 2,
      summarizedCount: 2,
      droppedCount: 2,
      llmCalls: 4,
      durationMs: 41250,
      skippedReason: null,
    });
    expect(row.findings.map((f) => [f.fingerprint, f.placement, f.severity])).toEqual([
      ["9bd99466492c", "INLINE", "CRITICAL"],
      ["fd2e362cd615", "INLINE", "HIGH"],
      ["8a33b1c63a08", "SUMMARY", "LOW"],
      ["ce5214f369d0", "SUMMARY", "NIT"],
    ]);
  });
});

describe("statDelta", () => {
  it.each([
    ["PENDING", "ACCEPTED", { accepted: 1, dismissed: 0 }],
    ["PENDING", "DISMISSED", { accepted: 0, dismissed: 1 }],
    ["ACCEPTED", "ACCEPTED", { accepted: 0, dismissed: 0 }],
    ["ACCEPTED", "DISMISSED", { accepted: -1, dismissed: 1 }],
    ["DISMISSED", "ACCEPTED", { accepted: 1, dismissed: -1 }],
  ] as const)("%s → %s", (prev, next, want) => expect(statDelta(prev, next)).toEqual(want));
});
