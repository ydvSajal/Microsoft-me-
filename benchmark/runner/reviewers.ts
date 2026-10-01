// The two reviewers the benchmark compares. Neither posts anything: GitHub writes are captured.
import { type LanguageModel, reviewHunks } from "@sift/ai";
import {
  contextHunks,
  type GitHub,
  type NewReview,
  type PatchId,
  type PrFile,
  parsePatch,
  runPrReview,
  selectFiles,
  type TPrEvent,
  workspaceReader,
} from "@sift/core";
import type { TFinding } from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";
import type { Posted } from "./score";

export type PrInput = { event: TPrEvent; workspace: string; files: PrFile[] };
export type Models = { reviewModel?: LanguageModel; judgeModel?: LanguageModel };
export type ReviewerOutput = {
  posted: Posted[];
  reported: Posted[];
  llmCalls: number;
  latencyMs: number;
  /** Bodies it would have posted; fed back in for the re-push measurement. */
  bodies: string[];
};
export type Reviewer = {
  name: string;
  review(pr: PrInput, prior?: ReviewerOutput): Promise<ReviewerOutput>;
};

const at = (f: Pick<TFinding, "file" | "line" | "fingerprint">): Posted => ({
  file: f.file,
  line: f.line,
  fingerprint: f.fingerprint,
});

/** Reads come from `files`; writes are captured, never sent. */
function dryRunGitHub(files: PrFile[], postedBodies: string[]) {
  const reviews: NewReview[] = [];
  const gh: GitHub = {
    listFiles: async () => files,
    listPostedBodies: async () => postedBodies,
    listOpenPrs: async () => [],
    listComments: async () => [],
    listResolvedThreadRoots: async () => new Set(),
    syncLabels: async () => {},
    createReview: async (_pr, review) => {
      reviews.push(review);
    },
  };
  return { gh, reviews };
}

/** The full pipeline, with stack and impact on, as the Action runs it. */
export function siftReviewer(models: Models, patchId?: (workspace: string) => PatchId): Reviewer {
  return {
    name: "sift",
    async review(pr, prior) {
      const { gh, reviews } = dryRunGitHub(pr.files, prior?.bodies ?? []);
      const r = await runPrReview(
        { event: pr.event, workspace: pr.workspace },
        { gh, ...models, features: new Set(["stack", "impact"]), patchId: patchId?.(pr.workspace) },
      );
      const reported = [...r.inline, ...r.summarized].flatMap((f) => [
        at(f),
        ...f.alsoIn.map((l) => ({ ...l, fingerprint: f.fingerprint })),
      ]);
      return {
        posted: r.inline.map(at),
        reported,
        llmCalls: r.stats.llmCalls,
        latencyMs: r.stats.durationMs,
        bodies: reviews.flatMap((rv) => [rv.body, ...rv.comments.map((c) => c.body)]),
      };
    },
  };
}

/**
 * Baseline: same model, prompt and code context, one call per file, and every finding posted where
 * the model said. No grounding, judge, ranking, budget or dedupe. It has no memory of earlier
 * pushes, so a re-push repeats its first run exactly (no extra model calls are spent proving that).
 */
export function naiveReviewer(models: Models): Reviewer {
  return {
    name: "naive",
    async review(pr, prior) {
      if (prior) return prior;
      const started = performance.now();
      const read = workspaceReader(pr.workspace);
      let llmCalls = 0;
      const posted: Posted[] = [];
      for (const f of selectFiles(pr.files).review) {
        const lines = read(f.filename) as string[] | null;
        if (!lines) continue;
        const out = await reviewHunks(
          { file: f.filename, hunks: contextHunks(parsePatch(f.patch ?? ""), lines) },
          { model: models.reviewModel },
        );
        llmCalls += out.llmCalls;
        for (const m of out.findings) posted.push(at({ ...m, fingerprint: fingerprint(m) }));
      }
      return {
        posted,
        reported: posted,
        llmCalls,
        latencyMs: Math.round(performance.now() - started),
        bodies: [],
      };
    },
  };
}
