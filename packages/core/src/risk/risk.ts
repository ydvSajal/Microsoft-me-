import { riskFromSeverities, type TRiskTier, type TSeverity } from "@sift/shared";
import { LARGE_PR_LINES, SENSITIVE_PATHS, SKIP_PATTERNS } from "../config";
import type { PrFile } from "../diff/diff-map";

export const riskLabel = (tier: TRiskTier) => `sift:risk-${tier}`;
export const RISK_LABELS = (["high", "medium", "low"] as const).map(riskLabel);
export const RISK_LABEL_COLOR: Record<TRiskTier, string> = {
  high: "d73a4a",
  medium: "fbca04",
  low: "0e8a16",
};

/** Added + removed lines across the PR, ignoring lockfiles, minified and generated files. */
export function changedLines(files: readonly PrFile[]): number {
  return files
    .filter((f) => !SKIP_PATTERNS.some((p) => p.test(f.filename)))
    .reduce((n, f) => n + (f.patch ?? "").split("\n").filter((l) => /^[+-]/.test(l)).length, 0);
}

/**
 * Risk tier (TRD §4.4). high: a critical/high finding or a sensitive path touched; medium: a medium
 * finding or a large PR; else low.
 * ponytail: the "exported signature changed with external callers" rule waits for impact analysis (T-16).
 */
export function riskTier(severities: readonly TSeverity[], files: readonly PrFile[]): TRiskTier {
  const bySeverity = riskFromSeverities(severities);
  if (bySeverity === "high" || files.some((f) => SENSITIVE_PATHS.some((p) => p.test(f.filename))))
    return "high";
  if (bySeverity === "medium" || changedLines(files) > LARGE_PR_LINES) return "medium";
  return "low";
}
