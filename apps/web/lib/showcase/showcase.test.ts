import { isUsableFix } from "@sift/ai";
import { describe, expect, it } from "vitest";
import { applyAll, applySuggestion, fixable } from "../fixes";
import { SHOWCASE } from "./index";

describe("showcase examples", () => {
  it("has the three recorded examples with unique slugs", () => {
    expect(SHOWCASE).toHaveLength(3);
    expect(new Set(SHOWCASE.map((e) => e.slug)).size).toBe(3);
  });

  it.each(SHOWCASE.map((e) => [e.slug, e] as const))(
    "%s: every quote is in the file and every fix applies",
    (_slug, e) => {
      for (const f of [...e.result.inline, ...e.result.summarized]) {
        expect(e.content, `${f.title}: quote not in file`).toContain(f.quotedCode);
      }
      for (const f of fixable(e.result)) {
        expect(applySuggestion(e.content, f.quotedCode, f.suggestion ?? "").ok, f.title).toBe(true);
      }
    },
  );

  it.each(SHOWCASE.map((e) => [e.slug, e] as const))(
    "%s: applying every fix leaves a file that still balances",
    (_slug, e) => {
      const out = applyAll(e.content, fixable(e.result));
      // Whole-file check: a fix that doesn't replace exactly its quote leaves stray brackets behind.
      if (out.content !== e.content) expect(isUsableFix(e.content, out.content)).toBe(true);
    },
  );

  it("includes one clean file that stays quiet", () => {
    expect(SHOWCASE.some((e) => e.result.inline.length + e.result.summarized.length === 0)).toBe(true);
  });
});
