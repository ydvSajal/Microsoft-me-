import type { ReviewOutput } from "@sift/ai";
import type { TModelFinding } from "@sift/shared";
import { describe, expect, it } from "vitest";
import { formatResult } from "./format";
import { buildFileResult, REVIEWABLE_FILE } from "@sift/ai";

const f = (over: Partial<TModelFinding>): TModelFinding => ({
  file: "src/checkout.ts",
  line: 40,
  severity: "critical",
  category: "bug",
  ruleKey: "missing-await",
  title: "`getTotal()` isn't awaited",
  body: "`total` is a Promise here.",
  suggestion: "const total = await cart.getTotal();",
  quotedCode: "const total = cart.getTotal();",
  confidence: 0.93,
  ...over,
});
const naming = f({
  line: 38,
  severity: "low",
  category: "naming",
  ruleKey: "unclear-name",
  title: "`d` is unclear",
  quotedCode: "const d = new Date();",
  confidence: 0.7,
});
const nit = f({
  line: 3,
  severity: "nit",
  category: "style",
  ruleKey: "quotes",
  title: "Single quotes",
  quotedCode: "'./log'",
});
const out = (findings: TModelFinding[], extra: Partial<ReviewOutput> = {}): ReviewOutput => ({
  whatChanged: "Checks out the cart.",
  findings,
  invalidCount: 0,
  llmCalls: 1,
  ...extra,
});

describe("buildFileResult", () => {
  it("ranks by severity × confidence, sends nits to the summary and sets the risk", () => {
    const r = buildFileResult(out([nit, naming, f({})]), 8123.4);
    expect(r.mode).toBe("file");
    expect(r.inline.map((x) => x.ruleKey)).toEqual(["missing-await", "unclear-name"]);
    expect(r.summarized.map((x) => x.ruleKey)).toEqual(["quotes"]);
    expect(r.riskTier).toBe("high");
    expect(r.inline[0]?.fingerprint).toBe("9bd99466492c"); // same as the shared fixture
    expect(r.stats).toEqual({ llmCalls: 1, durationMs: 8123 });
  });

  it("keeps one copy of a repeated finding and counts the rest as dropped", () => {
    const r = buildFileResult(out([f({}), f({ line: 52, confidence: 0.6 })], { invalidCount: 2 }), 1);
    expect(r.inline).toHaveLength(1);
    expect(r.inline[0]?.line).toBe(40);
    expect(r.droppedCount).toBe(3);
  });

  it("is low risk and clean with no findings", () => {
    const r = buildFileResult(out([]), 1);
    expect(r.riskTier).toBe("low");
    expect(r.inline).toEqual([]);
  });

  it("flags a model-output failure", () => {
    const r = buildFileResult(out([], { error: "schema", llmCalls: 2, whatChanged: "" }), 1);
    expect(r.stats.skippedReason).toBe("model-output-invalid");
  });

  it("clips whatChanged to the contract limit", () => {
    expect(buildFileResult(out([], { whatChanged: "x".repeat(500) }), 1).whatChanged).toHaveLength(400);
  });
});

describe("REVIEWABLE_FILE", () => {
  it.each(["a.ts", "b.tsx", "c.js", "d.mjs", "e.cjs", "f.jsx"])("accepts %s", (p) => {
    expect(REVIEWABLE_FILE.test(p)).toBe(true);
  });
  it.each(["a.py", "b.json", "c.ts.md", "Makefile"])("rejects %s", (p) => {
    expect(REVIEWABLE_FILE.test(p)).toBe(false);
  });
});

describe("formatResult", () => {
  it("prints the summary, ranked findings with suggestions, and collapsed nits", () => {
    const text = formatResult("src/checkout.ts", buildFileResult(out([nit, naming, f({})]), 8123), false);
    expect(text).toContain("Sift review · src/checkout.ts");
    expect(text).toContain("Risk: HIGH · 3 findings · 8.1s");
    expect(text).toContain("Checks out the cart.");
    expect(text).toContain("1. CRITICAL bug · line 40 (93% sure)");
    expect(text).toContain("     const total = await cart.getTotal();");
    expect(text.indexOf("CRITICAL")).toBeLessThan(text.indexOf("LOW"));
    expect(text).toContain("Nits (1)\n  - line 3: Single quotes");
    expect(text).not.toContain("\u001b["); // no colour codes when color = false
  });

  it("says so when the file is clean", () => {
    expect(formatResult("a.ts", buildFileResult(out([]), 1), false)).toContain(
      "No issues found. Looks clean.",
    );
  });
});
