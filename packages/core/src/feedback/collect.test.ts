import { describe, expect, it } from "vitest";
import { collectOutcomes, type PrComment, toFeedbackEvents } from "./collect";

let id = 1;
const sift = (fp: string, over: Partial<PrComment> = {}): PrComment => ({
  id: id++,
  body: `**🔴 Critical · bug** x\n\n<!-- sift:fp=${fp} -->`,
  line: 10,
  inReplyTo: null,
  author: "github-actions[bot]",
  isBot: true,
  reactions: { up: 0, down: 0 },
  ...over,
});
const reply = (to: PrComment, body: string, over: Partial<PrComment> = {}): PrComment => ({
  id: id++,
  body,
  line: to.line,
  inReplyTo: to.id,
  author: "senior-a",
  isBot: false,
  reactions: { up: 0, down: 0 },
  ...over,
});
const FP = (n: number) => String(n).repeat(12);

describe("collectOutcomes", () => {
  it("ignores comments without a Sift marker and untouched Sift comments", () => {
    const human = { ...sift(FP(1)), body: "looks fine", isBot: false };
    expect(collectOutcomes([human, sift(FP(2))], new Set())).toEqual([]);
  });

  it("line changed since the comment → accepted", () => {
    expect(collectOutcomes([sift(FP(1), { line: null })], new Set())).toEqual([
      { fingerprint: FP(1), outcome: "accepted", source: "line-changed" },
    ]);
  });

  it("reactions decide by majority", () => {
    const up = sift(FP(1), { reactions: { up: 2, down: 1 } });
    const down = sift(FP(2), { reactions: { up: 0, down: 1 } });
    const tie = sift(FP(3), { reactions: { up: 1, down: 1 } });
    expect(collectOutcomes([up, down, tie], new Set())).toEqual([
      { fingerprint: FP(1), outcome: "accepted", source: "reaction-up" },
      { fingerprint: FP(2), outcome: "dismissed", source: "reaction-down" },
    ]);
  });

  it("a /sift reply wins over everything else, newest human reply first", () => {
    const root = sift(FP(1), { line: null, reactions: { up: 3, down: 0 } });
    const comments = [root, reply(root, "/sift accept"), reply(root, "Actually /sift ignore\n/sift ignore")];
    expect(collectOutcomes(comments, new Set())).toEqual([
      { fingerprint: FP(1), outcome: "dismissed", source: "command-ignore" },
    ]);
  });

  it("bots can't issue commands", () => {
    const root = sift(FP(1));
    expect(collectOutcomes([root, reply(root, "/sift accept", { isBot: true })], new Set())).toEqual([]);
  });

  it("resolved thread on an unchanged line → dismissed", () => {
    const root = sift(FP(1));
    expect(collectOutcomes([root], new Set([root.id]))).toEqual([
      { fingerprint: FP(1), outcome: "dismissed", source: "resolved-unchanged" },
    ]);
  });

  it("toFeedbackEvents adds repo, PR and time", () => {
    const at = new Date("2026-10-01T10:00:00Z");
    expect(
      toFeedbackEvents([{ fingerprint: FP(1), outcome: "accepted", source: "line-changed" }], "o/r", 7, at),
    ).toEqual([
      {
        fingerprint: FP(1),
        outcome: "accepted",
        source: "line-changed",
        repo: "o/r",
        prNumber: 7,
        at: at.toISOString(),
      },
    ]);
  });
});
