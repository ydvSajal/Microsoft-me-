import { Octokit } from "@octokit/rest";
import type { PrFile } from "../diff/diff-map";

export type ReviewComment = { path: string; line: number; side: "RIGHT"; body: string };

/** Sift only ever comments: the type admits no other review event (FR-10). */
export type NewReview = { commit_id: string; body: string; event: "COMMENT"; comments: ReviewComment[] };

/** The GitHub calls the pipeline makes. Tests pass a fake with the same shape. */
export type GitHub = {
  listFiles(prNumber: number): Promise<PrFile[]>;
  createReview(prNumber: number, review: NewReview): Promise<void>;
};

export function createGitHub(token: string, owner: string, repo: string): GitHub {
  const octokit = new Octokit({ auth: token, userAgent: "sift-reviewer" });
  return {
    async listFiles(prNumber) {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });
      return files.map((f) => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch,
        previous_filename: f.previous_filename,
      }));
    },
    async createReview(prNumber, review) {
      await octokit.rest.pulls.createReview({ owner, repo, pull_number: prNumber, ...review });
    },
  };
}
