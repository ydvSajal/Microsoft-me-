import { describe, expect, it } from "vitest";
import { MAX_FILES } from "../config";
import { contextHunks, snippet } from "./context";
import { mapLimit } from "./map-limit";
import { selectFiles } from "./select-files";

describe("mapLimit", () => {
  it("keeps input order and never exceeds the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([30, 10, 20, 5, 15], 2, async (ms, i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, ms));
      inFlight--;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });
});

describe("selectFiles", () => {
  it("caps reviewed files at MAX_FILES and lists the overflow", () => {
    const files = Array.from({ length: MAX_FILES + 2 }, (_, i) => ({
      filename: `src/f${i}.ts`,
      status: "modified",
      patch: "@@ -1 +1 @@\n+x",
    }));
    const { review, skipped } = selectFiles(files);
    expect(review).toHaveLength(MAX_FILES);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]?.reason).toMatch(/limit/);
  });

  it("skips the .sift checkout, dist and minified files", () => {
    const { review, skipped } = selectFiles(
      [".sift/packages/core/src/run.ts", "dist/index.js", "public/app.min.js"].map((filename) => ({
        filename,
        status: "added",
        patch: "+x",
      })),
    );
    expect(review).toEqual([]);
    expect(skipped).toHaveLength(3);
  });
});

describe("contextHunks", () => {
  const file = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);

  it("widens each change by the context and flags added lines", () => {
    const [h] = contextHunks([{ newStart: 50, newEnd: 52, added: [51] }], file, 20);
    expect(h).toMatchObject({ startLine: 30, added: [51] });
    expect(h?.lines).toHaveLength(43);
    expect(h?.lines[0]).toBe("line 30");
  });

  it("clamps at the start and end of the file", () => {
    const hunks = contextHunks(
      [
        { newStart: 2, newEnd: 2, added: [2] },
        { newStart: 99, newEnd: 99, added: [99] },
      ],
      file,
      5,
    );
    expect(hunks.map((h) => [h.startLine, h.startLine + h.lines.length - 1])).toEqual([
      [1, 7],
      [94, 100],
    ]);
  });

  it("merges ranges that overlap after widening", () => {
    const hunks = contextHunks(
      [
        { newStart: 10, newEnd: 10, added: [10] },
        { newStart: 25, newEnd: 25, added: [25] },
      ],
      file,
      10,
    );
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({ startLine: 1, added: [10, 25] });
  });

  it("leaves out deletion-only hunks", () => {
    expect(contextHunks([{ newStart: 5, newEnd: 4, added: [] }], file)).toEqual([]);
  });

  it("snippet numbers the lines around a finding", () => {
    expect(snippet(["a", "b", "c", "d"], 2, 1)).toBe("1 | a\n2 | b\n3 | c");
  });
});
