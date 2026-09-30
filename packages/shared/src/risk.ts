import type { TRiskTier, TSeverity } from "./schemas";

/**
 * Risk tier from finding severities alone (the file-mode subset of TRD §4.4).
 * PR mode adds sensitive paths, PR size and impact on top of this.
 */
export function riskFromSeverities(severities: readonly TSeverity[]): TRiskTier {
  if (severities.some((s) => s === "critical" || s === "high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}
