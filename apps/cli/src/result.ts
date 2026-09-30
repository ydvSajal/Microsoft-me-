import type { ReviewOutput } from "@sift/ai";
import {
  riskFromSeverities,
  ReviewResult,
  SEVERITY_WEIGHT,
  type TFinding,
  type TModelFinding,
  type TReviewResult,
} from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";

export const REVIEWABLE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const WHAT_CHANGED_MAX = 400; // ReviewResult.whatChanged limit

const score = (f: TModelFinding) => SEVERITY_WEIGHT[f.severity] * f.confidence;

/** File mode: rank by severity × confidence, drop repeats, nits go to the summary. */
export function buildFileResult(out: ReviewOutput, durationMs: number): TReviewResult {
  const seen = new Set<string>();
  const findings: TFinding[] = [];
  const ranked = [...out.findings].sort((a, b) => score(b) - score(a) || a.line - b.line);
  for (const f of ranked) {
    const fp = fingerprint(f);
    if (seen.has(fp)) continue;
    seen.add(fp);
    findings.push({ ...f, fingerprint: fp, alsoIn: [] });
  }

  return ReviewResult.parse({
    mode: "file",
    riskTier: riskFromSeverities(findings.map((f) => f.severity)),
    whatChanged: out.whatChanged.slice(0, WHAT_CHANGED_MAX),
    inline: findings.filter((f) => f.severity !== "nit"),
    summarized: findings.filter((f) => f.severity === "nit"),
    droppedCount: out.invalidCount + (out.findings.length - findings.length),
    stats: {
      llmCalls: out.llmCalls,
      durationMs: Math.round(durationMs),
      skippedReason: out.error ? "model-output-invalid" : undefined,
    },
  });
}
