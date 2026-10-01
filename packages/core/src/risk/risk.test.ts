import { describe, expect, it } from "vitest";
import { LARGE_PR_LINES } from "../config";
import type { PrFile } from "../diff/diff-map";
import { changedLines, RISK_LABELS, riskLabel, riskTier } from "./risk";

const file = (filename: string, adds = 1, dels = 0): PrFile => ({
  filename,
  status: "modified",
  patch: `@@ -1 +1 @@\n${"-x\n".repeat(dels)}${"+x\n".repeat(adds)}`.trimEnd(),
});
const small = [file("src/cart.ts")];

describe("riskTier", () => {
  it.each([
    [["critical"], "high"],
    [["low", "high"], "high"],
    [["medium", "nit"], "medium"],
    [["low", "nit"], "low"],
    [[], "low"],
  ] as const)("severities %j → %s", (severities, tier) => {
    expect(riskTier(severities, small)).toBe(tier);
  });

  it.each([
    "src/auth/session.ts",
    "src/api/refund.ts",
    "src/payments.ts",
    "db/migrations/001.sql",
    "src/security.ts",
    ".github/workflows/ci.yml",
  ])("touching %s is high even with no findings", (path) => {
    expect(riskTier([], [file(path)])).toBe("high");
  });

  it("a large PR is medium; exactly at the limit is not", () => {
    expect(riskTier([], [file("src/a.ts", LARGE_PR_LINES + 1)])).toBe("medium");
    expect(riskTier([], [file("src/a.ts", LARGE_PR_LINES)])).toBe("low");
  });

  it("a changed signature with outside callers is high; otherwise impact alone changes nothing", () => {
    expect(riskTier([], small, true)).toBe("high");
    expect(riskTier([], small, false)).toBe("low");
  });

  it("sensitivity beats size and a lone nit stays low", () => {
    expect(riskTier(["nit"], [file("src/auth.ts", LARGE_PR_LINES + 1)])).toBe("high");
    expect(riskTier(["nit"], small)).toBe("low");
  });
});

describe("changedLines", () => {
  it("counts added and removed lines, ignoring lockfiles and files without a patch", () => {
    const files = [
      file("src/a.ts", 3, 2),
      file("pnpm-lock.yaml", 500),
      { filename: "logo.bin", status: "added" },
    ];
    expect(changedLines(files)).toBe(5);
  });
});

describe("labels", () => {
  it("names the three tiers", () => {
    expect(RISK_LABELS).toEqual(["sift:risk-high", "sift:risk-medium", "sift:risk-low"]);
    expect(riskLabel("low")).toBe("sift:risk-low");
  });
});
