import type { TFinding } from "@sift/shared";
import { describe, expect, it } from "vitest";
import { applyAll, applySuggestion, fixable } from "./fixes";

const finding = (over: Partial<TFinding>): TFinding => ({
  fingerprint: "abcdefabcdef",
  file: "src/a.ts",
  line: 1,
  severity: "high",
  category: "bug",
  ruleKey: "missing-await",
  title: "t",
  body: "b",
  quotedCode: "x",
  confidence: 0.9,
  alsoIn: [],
  ...over,
});

describe("applySuggestion", () => {
  it("keeps the indentation when the fix comes back without it", () => {
    const r = applySuggestion(
      "fn() {\n  const u = find();\n}",
      "  const u = find();",
      "const u = await find();",
    );
    expect(r).toEqual({ ok: true, content: "fn() {\n  const u = await find();\n}" });
  });

  it("replaces a quote that appears once", () => {
    const r = applySuggestion("a\nconst u = find();\nb", "const u = find();", "const u = await find();");
    expect(r).toEqual({ ok: true, content: "a\nconst u = await find();\nb" });
  });

  it("refuses when the quote is gone", () => {
    expect(applySuggestion("a\nb", "zzz", "y")).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses when the quote is repeated", () => {
    expect(applySuggestion("x\nx", "x", "y")).toEqual({ ok: false, reason: "ambiguous" });
  });

  it("handles multi-line quotes", () => {
    const r = applySuggestion("a\nif (x) {\n  f();\n}\nb", "if (x) {\n  f();\n}", "if (x) f();");
    expect(r).toEqual({ ok: true, content: "a\nif (x) f();\nb" });
  });

  it("matches a multi-line quote in CRLF content and keeps CRLF", () => {
    const r = applySuggestion(
      "a\r\nif (x) {\r\n  f();\r\n}\r\nb",
      "if (x) {\n  f();\n}",
      "if (x) {\n  await f();\n}",
    );
    expect(r).toEqual({ ok: true, content: "a\r\nif (x) {\r\n  await f();\r\n}\r\nb" });
  });
});

describe("fixable", () => {
  it("keeps findings with a different suggestion, ranked first then folded", () => {
    const a = finding({ fingerprint: "a".repeat(12), suggestion: "y" });
    const b = finding({ fingerprint: "b".repeat(12) });
    const c = finding({ fingerprint: "c".repeat(12), suggestion: "x" }); // same as the quote
    const d = finding({ fingerprint: "d".repeat(12), suggestion: "z" });
    expect(fixable({ inline: [a, b], summarized: [c, d] }).map((f) => f.fingerprint)).toEqual([
      "a".repeat(12),
      "d".repeat(12),
    ]);
  });
});

describe("applyAll", () => {
  it("applies what it can and reports the rest", () => {
    const ok = finding({ fingerprint: "1".repeat(12), quotedCode: "one()", suggestion: "await one()" });
    const gone = finding({ fingerprint: "2".repeat(12), quotedCode: "missing()", suggestion: "x" });
    const out = applyAll("one();\ntwo();", [ok, gone]);
    expect(out).toEqual({
      content: "await one();\ntwo();",
      applied: ["1".repeat(12)],
      skipped: ["2".repeat(12)],
    });
  });
});
