import type { TSeverity } from "./schemas";

/** Ranking weight per severity (TRD §4.3). Shared so file mode and PR mode rank identically. */
export const SEVERITY_WEIGHT: Record<TSeverity, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
  nit: 3,
};

/** What each severity means, by impact. One source for the review prompt, tooltips and the legend. */
export const SEVERITY_DEFINITIONS: Record<TSeverity, string> = {
  critical: "Crash or downtime, data loss or corruption, or a security breach on a common path.",
  high: "An important feature is broken, or a leak or slowdown users will notice.",
  medium: "Partly broken, slow only in specific cases, or wrong but recoverable data.",
  low: "Minor overhead, wrong logs or metrics, rare edge cases, or unclear naming.",
  nit: "Style preference only. No effect on behaviour.",
};
