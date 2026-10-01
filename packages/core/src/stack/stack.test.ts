import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectStack,
  gitPatchId,
  lastPatchId,
  type OpenPr,
  parsePatchId,
  stackLayers,
  tierFromLabels,
} from "./stack";

const pr = (number: number, headRef: string, baseRef: string, labels: string[] = []): OpenPr => ({
  number,
  title: `PR ${number}`,
  headRef,
  baseRef,
  labels,
});
const nums = (prs: OpenPr[]) => prs.map((p) => p.number);

// main <- #1 (a) <- #2 (b) <- #3 (c);  #9 is unrelated
const L1 = pr(1, "a", "main");
const L2 = pr(2, "b", "a");
const L3 = pr(3, "c", "b");
const OTHER = pr(9, "z", "main");

describe("detectStack", () => {
  it.each([L1, L2, L3])("finds the whole chain, bottom to top, from layer #$number", (from) => {
    expect(nums(detectStack([L3, OTHER, L1, L2], from))).toEqual([1, 2, 3]);
  });

  it("is just the PR when nothing is stacked on or under it", () => {
    expect(nums(detectStack([L1, L2, L3, OTHER], OTHER))).toEqual([9]);
    expect(nums(detectStack([], L1))).toEqual([1]);
  });

  it("uses the event's PR even if the open list doesn't have it yet", () => {
    expect(nums(detectStack([L1], L2))).toEqual([1, 2]);
  });

  it("survives a cycle", () => {
    const x = pr(5, "x", "y");
    const y = pr(6, "y", "x");
    expect(nums(detectStack([x, y], x)).sort()).toEqual([5, 6]);
  });
});

describe("risk map", () => {
  it("reads the tier from the sift:risk-* label", () => {
    expect(tierFromLabels(["bug", "sift:risk-medium"])).toBe("medium");
    expect(tierFromLabels(["sift:risk-high"])).toBe("high");
    expect(tierFromLabels(["bug"])).toBeNull();
  });

  it("uses this run for the current layer and label + posted markers for the rest", () => {
    const layers = [
      pr(1, "a", "main", ["sift:risk-low"]),
      pr(2, "b", "a"),
      pr(3, "c", "b", ["sift:risk-high"]),
    ];
    const posted = new Map([
      [1, ["- x <!-- sift:fp=aaaaaaaaaaaa -->", "<!-- sift:fp=aaaaaaaaaaaa -->"]],
      [3, ["<!-- sift:fp=bbbbbbbbbbbb --> <!-- sift:fp=cccccccccccc -->"]],
    ]);
    expect(stackLayers(layers, { number: 2, riskTier: "medium", findings: 4 }, posted)).toEqual([
      { prNumber: 1, riskTier: "low", findings: 1, skipped: false },
      { prNumber: 2, riskTier: "medium", findings: 4, skipped: false },
      { prNumber: 3, riskTier: "high", findings: 2, skipped: false },
    ]);
  });

  it("marks a layer Sift hasn't labelled as skipped", () => {
    const [, other] = stackLayers(
      [pr(1, "a", "main"), pr(2, "b", "a")],
      { number: 1, riskTier: "low", findings: 0 },
      new Map(),
    );
    expect(other).toEqual({ prNumber: 2, riskTier: "low", findings: 0, skipped: true });
  });
});

describe("patch-id", () => {
  it("reads the newest marker from Sift summaries", () => {
    const bodies = ["x <!-- sift:patch=aaaa1111 -->", "human", "<!-- sift:patch=bbbb2222 -->"];
    expect(lastPatchId(bodies)).toBe("bbbb2222");
    expect(lastPatchId(["nothing here"])).toBeNull();
  });

  it("parses `git patch-id` output", () => {
    expect(parsePatchId("0a1b2c3d4e5f60718293a4b5c6d7e8f901234567 deadbeef\n")).toBe(
      "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567",
    );
    expect(parsePatchId("")).toBeNull();
  });

  describe("gitPatchId on a real repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-git-"));
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    };
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, env }).toString().trim();
    const write = (name: string, text: string) => writeFileSync(join(dir, name), text);

    git("init", "-q", "-b", "main");
    write("a.txt", "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n");
    git("add", "-A");
    git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    // The layer's own change: edit line 7.
    git("checkout", "-qb", "layer");
    write("a.txt", "one\ntwo\nthree\nfour\nfive\nsix\nSEVEN\neight\n");
    git("commit", "-qam", "layer change");
    const layer = git("rev-parse", "HEAD");
    // A lower layer lands a change near the top, then the layer is rebased on it: new sha, same patch.
    git("checkout", "-q", "main");
    write("a.txt", "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n");
    git("commit", "-qam", "lower layer");
    const newBase = git("rev-parse", "HEAD");
    git("checkout", "-q", "layer");
    git("rebase", "-q", "main");
    const rebased = git("rev-parse", "HEAD");
    // A real edit to the layer.
    write("a.txt", "ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN\nEIGHT\n");
    git("commit", "-qam", "edit layer");
    const edited = git("rev-parse", "HEAD");
    const patchId = gitPatchId(dir);

    it("is the same after a rebase onto a changed base, and different after a real edit", () => {
      const before = patchId(base, layer);
      expect(before).toMatch(/^[0-9a-f]{40}$/);
      expect(rebased).not.toBe(layer);
      expect(patchId(newBase, rebased)).toBe(before);
      expect(patchId(newBase, edited)).not.toBe(before);
    });

    it("returns null instead of throwing when git can't answer", () => {
      expect(patchId("0".repeat(40), "1".repeat(40))).toBeNull();
      expect(gitPatchId(join(tmpdir(), "definitely-not-a-repo-sift"))(base, layer)).toBeNull();
      expect(patchId(layer, layer)).toBeNull(); // empty diff
    });
  });
});
