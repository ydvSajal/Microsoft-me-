import { buildDiffMap } from "@sift/core";
import type { TLabels } from "./labels";
import type { PrInput, Reviewer } from "./reviewers";
import { medianScore, type PrRun, type RunScore, scoreRun } from "./score";

/**
 * Every reviewer × every labelled PR × `runs`, scored per run, then the median per metric.
 * `prepare` checks out a PR and returns its event, files and workspace (done once per PR).
 */
export async function benchmark(opts: {
  labels: TLabels;
  reviewers: readonly Reviewer[];
  runs: number;
  prepare: (pr: number) => Promise<PrInput>;
  log?: (line: string) => void;
}): Promise<Record<string, RunScore>> {
  const log = opts.log ?? (() => {});
  const inputs = new Map<number, PrInput>();
  for (const l of opts.labels.prs) inputs.set(l.pr, await opts.prepare(l.pr));

  const scores: Record<string, RunScore> = {};
  for (const reviewer of opts.reviewers) {
    const runScores: RunScore[] = [];
    for (let run = 1; run <= opts.runs; run++) {
      const prRuns: PrRun[] = [];
      for (const label of opts.labels.prs) {
        const input = inputs.get(label.pr) as PrInput;
        const first = await reviewer.review(input);
        const rerun = label.kind === "stack" ? await reviewer.review(input, first) : undefined;
        prRuns.push({
          pr: label,
          posted: first.posted,
          reported: first.reported,
          diff: buildDiffMap(input.files),
          latencyMs: first.latencyMs,
          llmCalls: first.llmCalls,
          rerun: rerun && {
            posted: rerun.posted.length,
            llmCalls: rerun === first ? first.llmCalls : rerun.llmCalls,
          },
        });
        log(
          `${reviewer.name} run ${run} PR #${label.pr}: ${first.posted.length} posted, ${first.llmCalls} calls`,
        );
      }
      runScores.push(scoreRun(prRuns));
    }
    scores[reviewer.name] = medianScore(runScores);
  }
  return scores;
}
