import type { TFinding, TSeverity } from "@sift/shared";
import { describe, expect, it } from "vitest";
import { MAX_INLINE, MIN_CONFIDENCE } from "../config";
import type { Placement } from "../validate/grounding";
import { type Candidate, rank, score } from "./rank";

let n = 0;
const c = (
  over: Partial<TFinding> = {},
  placement: Placement = "inline",
  severity: TSeverity = "medium",
): Candidate => ({
  placement,
  finding: {
    fingerprint: String(n++).padStart(12, "0"),
    file: "a.ts",
    line: 1,
    severity,
    category: "bug",
    ruleKey: "some-rule",
    title: "t",
    body: "b",
    quotedCode: "x",
    confidence: 0.9,
    alsoIn: [],
    ...over,
  },
});
const ids = (fs: TFinding[]) => fs.map((f) => f.fingerprint);

describe("score", () => {
  it("is severity weight × confidence", () => {
    expect(score(c({ confidence: 0.5 }, "inline", "high").finding)).toBe(30);
  });
});

describe("rank", () => {
  it("drops findings under the confidence floor and counts them", () => {
    const keep = c({ confidence: MIN_CONFIDENCE });
    const low = c({ confidence: MIN_CONFIDENCE - 0.01 });
    const r = rank([low, keep]);
    expect(ids(r.inline)).toEqual(ids([keep.finding]));
    expect(r.dropped).toBe(1);
  });

  it("orders by score, so a confident medium can beat a shaky high", () => {
    const shakyHigh = c({ confidence: 0.6 }, "inline", "high"); // 36
    const sureMedium = c({ confidence: 1 }, "inline", "medium"); // 30
    const sureLow = c({ confidence: 1 }, "inline", "low"); // 10
    expect(ids(rank([sureLow, sureMedium, shakyHigh]).inline)).toEqual(
      ids([shakyHigh.finding, sureMedium.finding, sureLow.finding]),
    );
  });

  it("breaks ties by file path, then line", () => {
    const b2 = c({ file: "b.ts", line: 2 });
    const a9 = c({ file: "a.ts", line: 9 });
    const a3 = c({ file: "a.ts", line: 3 });
    expect(ids(rank([b2, a9, a3]).inline)).toEqual(ids([a3.finding, a9.finding, b2.finding]));
  });

  it(`posts at most ${MAX_INLINE} inline; the rest keep their rank in the summary`, () => {
    const all = Array.from({ length: MAX_INLINE + 3 }, (_, i) => c({ confidence: 1 - i * 0.01 }));
    const r = rank([...all].reverse());
    expect(ids(r.inline)).toEqual(ids(all.slice(0, MAX_INLINE).map((x) => x.finding)));
    expect(ids(r.summarized)).toEqual(ids(all.slice(MAX_INLINE).map((x) => x.finding)));
  });

  it("never posts a nit inline, even with budget left", () => {
    const nit = c({ confidence: 1 }, "inline", "nit");
    const r = rank([nit]);
    expect(r.inline).toEqual([]);
    expect(ids(r.summarized)).toEqual(ids([nit.finding]));
  });

  it("sends off-diff findings to the summary regardless of score", () => {
    const off = c({ confidence: 1 }, "summary", "critical");
    const on = c({ confidence: 0.7 }, "inline", "low");
    const r = rank([off, on]);
    expect(ids(r.inline)).toEqual(ids([on.finding]));
    expect(ids(r.summarized)).toEqual(ids([off.finding]));
  });

  it("a muted category drops only its low and nit findings", () => {
    const lowStyle = c({ category: "style" }, "inline", "low");
    const nitStyle = c({ category: "style" }, "inline", "nit");
    const highStyle = c({ category: "style" }, "inline", "high");
    const lowBug = c({ category: "bug" }, "inline", "low");
    const r = rank([lowStyle, nitStyle, highStyle, lowBug], ["style"]);
    expect(ids([...r.inline, ...r.summarized])).toEqual(ids([highStyle.finding, lowBug.finding]));
    expect(r.dropped).toBe(2);
  });

  it("handles no findings", () => {
    expect(rank([])).toEqual({ inline: [], summarized: [], dropped: 0 });
  });
});
