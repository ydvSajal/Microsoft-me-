import type { TFinding } from "@sift/shared";
import { byScore, type Candidate } from "../rank/rank";

/** critical/high/medium dedupe on the exact code; low/nit collapse per rule across the PR (TRD §4.2). */
const EXACT_SEVERITIES: readonly string[] = ["critical", "high", "medium"];
export const groupKey = (f: TFinding) =>
  EXACT_SEVERITIES.includes(f.severity) ? f.fingerprint : `${f.category}:${f.ruleKey}`;

/** One finding per group: the highest-scored one, with the other locations in `alsoIn`. */
export function groupFindings(candidates: readonly Candidate[]): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = groupKey(c.finding);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.values()].map((group) => {
    const [best, ...others] = [...group].sort(byScore) as [Candidate, ...Candidate[]];
    const seen = new Set([`${best.finding.file}:${best.finding.line}`]);
    const alsoIn = others
      .map(({ finding: o }) => ({ file: o.file, line: o.line }))
      .filter((l) => !seen.has(`${l.file}:${l.line}`) && seen.add(`${l.file}:${l.line}`));
    return { placement: best.placement, finding: { ...best.finding, alsoIn } };
  });
}
