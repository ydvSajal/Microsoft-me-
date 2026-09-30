import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { type JudgeItem, judge } from "./judge";
import { mockModel } from "./mock";

const item = (fingerprint: string): JudgeItem => ({
  fingerprint,
  file: "src/checkout.ts",
  line: 3,
  severity: "critical",
  category: "bug",
  title: "`getTotal()` isn't awaited",
  body: "`total` is a Promise.",
  quotedCode: "const total = cart.getTotal();",
  code: "3 | const total = cart.getTotal();",
});
const scores = (s: [string, number][]) =>
  JSON.stringify({ scores: s.map(([fingerprint, confidence]) => ({ fingerprint, confidence })) });

describe("judge", () => {
  it("re-scores every finding in one batched call", async () => {
    const model = mockModel([
      scores([
        ["aaaaaaaaaaaa", 0.95],
        ["bbbbbbbbbbbb", 0.2],
      ]),
    ]);
    const out = await judge([item("aaaaaaaaaaaa"), item("bbbbbbbbbbbb")], { model });
    expect(out.scores).toEqual(
      new Map([
        ["aaaaaaaaaaaa", 0.95],
        ["bbbbbbbbbbbb", 0.2],
      ]),
    );
    expect(out.llmCalls).toBe(1);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]?.temperature).toBe(0);
  });

  it("wraps findings as data and includes the code around them", async () => {
    const model = mockModel([scores([])]);
    await judge([item("aaaaaaaaaaaa")], { model });
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("<findings>");
    expect(prompt).toContain("fingerprint: aaaaaaaaaaaa");
    expect(prompt).toContain("3 | const total = cart.getTotal();");
  });

  it("ignores scores for findings it wasn't given and clamps out-of-range values", async () => {
    const model = mockModel([
      scores([
        ["aaaaaaaaaaaa", 1.7],
        ["zzzzzzzzzzzz", 0.9],
      ]),
    ]);
    const out = await judge([item("aaaaaaaaaaaa")], { model });
    expect(out.scores).toEqual(new Map([["aaaaaaaaaaaa", 1]]));
  });

  it("leaves unscored findings out, so their original confidence stands", async () => {
    const out = await judge([item("aaaaaaaaaaaa"), item("bbbbbbbbbbbb")], {
      model: mockModel([scores([["aaaaaaaaaaaa", 0.8]])]),
    });
    expect(out.scores.has("bbbbbbbbbbbb")).toBe(false);
  });

  it("returns no scores (keep originals) when the output is malformed", async () => {
    const out = await judge([item("aaaaaaaaaaaa")], { model: mockModel(["{not json"]) });
    expect(out.scores.size).toBe(0);
    expect(out.error).toBeDefined();
  });

  it("returns no scores when the provider fails", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("503 unavailable");
      },
    });
    const out = await judge([item("aaaaaaaaaaaa")], { model });
    expect(out).toMatchObject({ llmCalls: 1, error: "503 unavailable" });
    expect(out.scores.size).toBe(0);
  });

  it("makes no call when there is nothing to judge", async () => {
    const model = mockModel([scores([])]);
    expect(await judge([], { model })).toEqual({ scores: new Map(), llmCalls: 0 });
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
