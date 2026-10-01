import type { TFinding } from "@sift/shared";
import { MAX_INLINE, MIN_CONFIDENCE, SEVERITY_WEIGHT } from "../config";
import type { Placement } from "../validate/grounding";

export type Candidate = { finding: TFinding; placement: Placement };

export const score = (f: TFinding) => SEVERITY_WEIGHT[f.severity] * f.confidence;

/** Highest score first; ties broken by file path, then line (TRD §4.3). */
export const byScore = (a: Candidate, b: Candidate) =>
  score(b.finding) - score(a.finding) ||
  a.finding.file.localeCompare(b.finding.file) ||
  a.finding.line - b.finding.line;

/**
 * Confidence floor → score → inline budget (TRD §4.3 steps 1, 3, 4).
 * Inline = first MAX_INLINE non-nit findings that sit on the diff; everything else is summarized.
 * `dropped` counts findings under the floor.
 */
export function rank(candidates: readonly Candidate[]): {
  inline: TFinding[];
  summarized: TFinding[];
  dropped: number;
} {
  const kept = candidates.filter((c) => c.finding.confidence >= MIN_CONFIDENCE).sort(byScore);
  const inline: TFinding[] = [];
  const summarized: TFinding[] = [];
  for (const { finding, placement } of kept) {
    const fits = placement === "inline" && finding.severity !== "nit" && inline.length < MAX_INLINE;
    (fits ? inline : summarized).push(finding);
  }
  return { inline, summarized, dropped: candidates.length - kept.length };
}
