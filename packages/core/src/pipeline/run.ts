import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { judge, type LanguageModel, reviewHunks } from "@sift/ai";
import { riskFromSeverities, ReviewResult, type TFinding, type TReviewResult } from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";
import { LLM_CONCURRENCY, MAX_INLINE, MIN_CONFIDENCE, SEVERITY_WEIGHT } from "../config";
import { buildDiffMap } from "../diff/diff-map";
import { parsePatch } from "../diff/parse-patch";
import type { GitHub, NewReview } from "../github/client";
import { groundFinding, type Placement } from "../validate/grounding";
import { contextHunks, snippet } from "./context";
import type { TPrEvent } from "./event";
import { mapLimit } from "./map-limit";
import { inlineBody, summaryBody } from "./render";
import { type SkippedFile, selectFiles } from "./select-files";

export type RunContext = { event: TPrEvent; workspace: string };
export type RunDeps = {
  gh: GitHub;
  /** Injected in tests; default to the env-configured models. */
  reviewModel?: LanguageModel;
  judgeModel?: LanguageModel;
};

type Candidate = { finding: TFinding; placement: Placement };
const WHAT_CHANGED_MAX = 400; // ReviewResult.whatChanged limit

/** Reads a changed file from the checkout, refusing paths that escape it. */
function readWorkspaceFile(workspace: string, file: string): string[] | null {
  const root = resolve(workspace);
  const path = resolve(root, file);
  if (!path.startsWith(root + sep)) return null;
  try {
    return readFileSync(path, "utf8")
      .replace(/\r?\n$/, "")
      .split(/\r?\n/);
  } catch {
    return null;
  }
}

const score = (f: TFinding) => SEVERITY_WEIGHT[f.severity] * f.confidence;
const byScore = (a: Candidate, b: Candidate) =>
  score(b.finding) - score(a.finding) ||
  a.finding.file.localeCompare(b.finding.file) ||
  a.finding.line - b.finding.line;

/**
 * The PR review pipeline (ARCHITECTURE §2): select files → diff map → one model call per file
 * → fingerprint → ground → judge → confidence floor → rank + budget → one COMMENT review.
 * A failing file never fails the review (NFR-03); it's listed under skipped files.
 */
export async function runPrReview({ event, workspace }: RunContext, deps: RunDeps): Promise<TReviewResult> {
  const started = performance.now();
  const pr = event.pull_request;
  const files = await deps.gh.listFiles(pr.number);
  const diffMap = buildDiffMap(files);
  const { review, skipped } = selectFiles(files);
  const skippedFiles: SkippedFile[] = [...skipped];
  let llmCalls = 0;
  let dropped = 0;

  // 1. Review each file, with real surrounding code as context.
  const perFile = await mapLimit(review, LLM_CONCURRENCY, async (f) => {
    const lines = readWorkspaceFile(workspace, f.filename);
    if (!lines) {
      skippedFiles.push({ file: f.filename, reason: "not found in the checkout" });
      return null;
    }
    try {
      const hunks = contextHunks(parsePatch(f.patch ?? ""), lines);
      const out = await reviewHunks({ file: f.filename, hunks }, { model: deps.reviewModel });
      llmCalls += out.llmCalls;
      dropped += out.invalidCount;
      if (out.error) skippedFiles.push({ file: f.filename, reason: "model output unreadable twice" });
      return { file: f.filename, lines, out };
    } catch (err) {
      llmCalls += 1;
      skippedFiles.push({
        file: f.filename,
        reason: `review failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return null;
    }
  });

  // 2. Fingerprint and ground every finding against the real file and the diff map.
  const candidates: Candidate[] = [];
  const linesByFile = new Map<string, string[]>();
  for (const r of perFile) {
    if (!r) continue;
    linesByFile.set(r.file, r.lines);
    for (const mf of r.out.findings) {
      const finding: TFinding = { ...mf, fingerprint: fingerprint(mf), alsoIn: [] };
      const grounded = groundFinding(finding, r.lines, diffMap.get(r.file) ?? new Set());
      if (grounded) candidates.push(grounded);
      else dropped++;
    }
  }

  // 3. Judge re-scores confidence in one batch; failures keep the original scores.
  const verdict = await judge(
    candidates.map(({ finding: f }) => ({ ...f, code: snippet(linesByFile.get(f.file) ?? [], f.line) })),
    { model: deps.judgeModel },
  );
  llmCalls += verdict.llmCalls;
  for (const c of candidates) {
    const s = verdict.scores.get(c.finding.fingerprint);
    if (s !== undefined) c.finding.confidence = s;
  }

  // 4. Confidence floor, one copy per fingerprint, rank, inline budget.
  const seen = new Set<string>();
  const kept = candidates
    .filter((c) => c.finding.confidence >= MIN_CONFIDENCE)
    .sort(byScore)
    .filter((c) => !seen.has(c.finding.fingerprint) && seen.add(c.finding.fingerprint));
  dropped += candidates.length - kept.length;

  const inline: TFinding[] = [];
  const summarized: TFinding[] = [];
  for (const c of kept) {
    const fits = c.placement === "inline" && c.finding.severity !== "nit" && inline.length < MAX_INLINE;
    (fits ? inline : summarized).push(c.finding);
  }

  const result = ReviewResult.parse({
    mode: "pr",
    repo: `${event.repository.owner.login}/${event.repository.name}`,
    prNumber: pr.number,
    prTitle: pr.title,
    author: pr.user.login,
    requestedReviewers: pr.requested_reviewers.map((r) => r.login),
    headSha: pr.head.sha,
    riskTier: riskFromSeverities(kept.map((c) => c.finding.severity)),
    whatChanged: perFile
      .flatMap((r) => (r?.out.whatChanged ? [r.out.whatChanged] : []))
      .join(" ")
      .slice(0, WHAT_CHANGED_MAX),
    inline,
    summarized,
    droppedCount: dropped,
    skippedFiles,
    stats: { llmCalls, durationMs: Math.round(performance.now() - started) },
  });

  await postReview(deps.gh, pr.number, pr.head.sha, result);
  return result;
}

/**
 * One COMMENT review pinned to the reviewed commit. Grounding should make GitHub's 422
 * ("line must be part of the diff") impossible; if one still happens, repost with every
 * finding in the summary so the review always lands.
 */
async function postReview(gh: GitHub, prNumber: number, commitId: string, r: TReviewResult) {
  const review: NewReview = {
    commit_id: commitId,
    event: "COMMENT",
    body: summaryBody(r),
    comments: r.inline.map((f) => ({ path: f.file, line: f.line, side: "RIGHT", body: inlineBody(f) })),
  };
  try {
    await gh.createReview(prNumber, review);
  } catch (err) {
    if ((err as { status?: number }).status !== 422 || review.comments.length === 0) throw err;
    console.log(`::warning::GitHub rejected inline comments (422); posting them in the summary instead.`);
    await gh.createReview(prNumber, { ...review, body: summaryBody(r, true), comments: [] });
  }
}
