import { describe, expect, it } from "vitest";
import type { PrFile } from "../diff/diff-map";
import { fakeGitHub, loadFixture, prEvent } from "../testing";
import { runPrReview } from "./run";

const files = loadFixture("patch-multi-hunk.json") as PrFile[];
const ctx = { event: prEvent(), workspace: "." };

describe("runPrReview (skeleton)", () => {
  it("posts exactly one COMMENT review pinned to the head commit", async () => {
    const { gh, reviews } = fakeGitHub(files);
    await runPrReview(ctx, { gh });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.event).toBe("COMMENT");
    expect(reviews[0]?.commit_id).toBe(ctx.event.pull_request.head.sha);
  });

  it("puts its stub comment on a commentable RIGHT-side line", async () => {
    const { gh, reviews } = fakeGitHub(files);
    const summary = await runPrReview(ctx, { gh });
    expect(reviews[0]?.comments).toEqual([
      { path: "src/cart.ts", line: 12, side: "RIGHT", body: expect.any(String) },
    ]);
    expect(summary).toEqual({ inline: 1, files: 5 });
  });

  it("posts a summary-only review when nothing is commentable", async () => {
    const { gh, reviews } = fakeGitHub([{ filename: "logo.png", status: "added" }]);
    await runPrReview(ctx, { gh });
    expect(reviews[0]?.comments).toEqual([]);
    expect(reviews[0]?.body).toContain("1 changed file");
  });
});
