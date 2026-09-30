import type { TSeverity } from "./schemas";

/** Ranking weight per severity (TRD §4.3). Shared so file mode and PR mode rank identically. */
export const SEVERITY_WEIGHT: Record<TSeverity, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
  nit: 3,
};
