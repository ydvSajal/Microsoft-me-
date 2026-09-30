import { buildDiffMap } from "../diff/diff-map";
import type { GitHub, ReviewComment } from "../github/client";
import type { TPrEvent } from "./event";

export type RunContext = { event: TPrEvent; workspace: string };
export type RunDeps = { gh: GitHub };
export type RunSummary = { inline: number; files: number };

/**
 * Skeleton (T-08): one COMMENT review pinned to the head commit, with a stub finding on the
 * first commentable line. T-10 replaces the stub with the real review pipeline.
 */
export async function runPrReview({ event }: RunContext, { gh }: RunDeps): Promise<RunSummary> {
  const pr = event.pull_request;
  const files = await gh.listFiles(pr.number);
  const diffMap = buildDiffMap(files);

  const comments: ReviewComment[] = [];
  for (const [path, lines] of diffMap) {
    const [first] = [...lines];
    if (first === undefined) continue;
    comments.push({ path, line: first, side: "RIGHT", body: "Sift skeleton: this line is commentable." });
    break;
  }

  await gh.createReview(pr.number, {
    commit_id: pr.head.sha,
    event: "COMMENT",
    body: `Sift skeleton review: ${files.length} changed file(s), ${comments.length} inline comment(s).`,
    comments,
  });
  return { inline: comments.length, files: files.length };
}
