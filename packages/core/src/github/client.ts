import { Octokit } from "@octokit/rest";
import type { PrFile } from "../diff/diff-map";

export type ReviewComment = { path: string; line: number; side: "RIGHT"; body: string };

/** Sift only ever comments: the type admits no other review event (FR-10). */
export type NewReview = { commit_id: string; body: string; event: "COMMENT"; comments: ReviewComment[] };

/** The GitHub calls the pipeline makes. Tests pass a fake with the same shape. */
export type GitHub = {
  listFiles(prNumber: number): Promise<PrFile[]>;
  createReview(prNumber: number, review: NewReview): Promise<void>;
  /** Bodies of every review and inline review comment on the PR, for reading back `sift:fp` markers. */
  listPostedBodies(prNumber: number): Promise<string[]>;
  /** Make `add` the only label of its kind on the PR: create it if missing, remove the `remove` ones. */
  syncLabels(prNumber: number, change: LabelChange): Promise<void>;
};

export type LabelChange = {
  add: { name: string; color: string; description: string };
  remove: readonly string[];
};

const isStatus = (err: unknown, status: number) => (err as { status?: number }).status === status;

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
    async listPostedBodies(prNumber) {
      const base = { owner, repo, pull_number: prNumber, per_page: 100 };
      const [reviews, comments] = await Promise.all([
        octokit.paginate(octokit.rest.pulls.listReviews, base),
        octokit.paginate(octokit.rest.pulls.listReviewComments, base),
      ]);
      return [...reviews, ...comments].map((x) => x.body ?? "");
    },
    async syncLabels(prNumber, { add, remove }) {
      // 422 = label already exists; 404 = label wasn't on the PR. Both are the state we want.
      await octokit.rest.issues.createLabel({ owner, repo, ...add }).catch((e) => {
        if (!isStatus(e, 422)) throw e;
      });
      for (const name of remove) {
        await octokit.rest.issues.removeLabel({ owner, repo, issue_number: prNumber, name }).catch((e) => {
          if (!isStatus(e, 404)) throw e;
        });
      }
      await octokit.rest.issues.addLabels({ owner, repo, issue_number: prNumber, labels: [add.name] });
    },
    async createReview(prNumber, review) {
      await octokit.rest.pulls.createReview({ owner, repo, pull_number: prNumber, ...review });
    },
  };
}
