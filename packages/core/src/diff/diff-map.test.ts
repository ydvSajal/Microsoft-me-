import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDiffMap, type PrFile } from "./diff-map";
import { parsePatch } from "./parse-patch";

const fixture = JSON.parse(
  readFileSync(new URL("../../../shared/src/fixtures/patch-multi-hunk.json", import.meta.url), "utf8"),
) as PrFile[];

const lines = (m: Map<string, Set<number>>, file: string) => [...(m.get(file) ?? [])];

describe("buildDiffMap on the shared multi-hunk fixture", () => {
  const map = buildDiffMap(fixture);

  it("tracks the right-side counter across two hunks of one file", () => {
    expect(lines(map, "src/cart.ts")).toEqual([12, 43, 44, 45, 46]);
  });

  it("skips removed lines when counting", () => {
    expect(lines(map, "src/checkout.ts")).toEqual([39, 40]);
  });

  it("gives removed files an empty set", () => {
    expect(lines(map, "src/old-coupons.ts")).toEqual([]);
  });

  it("gives binary files (no patch) an empty set", () => {
    expect(lines(map, "public/logo.png")).toEqual([]);
  });

  it("keys renamed files by their new name", () => {
    expect(map.has("src/api/refunds.ts")).toBe(true);
    expect(map.has("src/api/refund.ts")).toBe(false);
  });
});

describe("parsePatch", () => {
  it("handles a brand-new file", () => {
    expect(parsePatch("@@ -0,0 +1,3 @@\n+a\n+b\n+c")).toEqual([{ newStart: 1, newEnd: 3, added: [1, 2, 3] }]);
  });

  it("handles a deletion-only hunk (nothing commentable, empty range)", () => {
    expect(parsePatch("@@ -5,2 +4,0 @@\n-x\n-y")).toEqual([{ newStart: 4, newEnd: 3, added: [] }]);
  });

  it("handles headers without counts", () => {
    expect(parsePatch("@@ -1 +1 @@\n-old\n+new")).toEqual([{ newStart: 1, newEnd: 1, added: [1] }]);
  });

  it("ignores 'No newline at end of file' markers", () => {
    const patch = "@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n\\ No newline at end of file";
    expect(parsePatch(patch)).toEqual([{ newStart: 1, newEnd: 2, added: [2] }]);
  });

  it("counts a blank context line whose leading space was stripped", () => {
    expect(parsePatch("@@ -1,3 +1,4 @@\n a\n\n+c\n d")[0]?.added).toEqual([3]);
  });

  it("ignores a trailing newline and text before the first header", () => {
    expect(parsePatch("diff --git a/x b/x\n@@ -1,1 +1,2 @@\n a\n+b\n")).toEqual([
      { newStart: 1, newEnd: 2, added: [2] },
    ]);
  });

  it("records the hunk range including context, for building model context later", () => {
    const [first, second] = parsePatch("@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n@@ -20,2 +20,3 @@\n t\n+u\n v");
    expect(first).toEqual({ newStart: 1, newEnd: 3, added: [2] });
    expect(second).toEqual({ newStart: 20, newEnd: 22, added: [21] });
  });

  it("returns nothing for an empty patch", () => {
    expect(parsePatch("")).toEqual([]);
  });
});
