import { SEVERITY_DEFINITIONS, type TReviewResult, type TSeverity } from "@sift/shared";
import type { ReactNode } from "react";
import { duration, fromFinding } from "@/lib/view";
import { FindingList, Inline, Panel, RiskBadge } from "./ui";

/** A review result as Sift shows it: risk, what changed, and the ranked findings. Used on the
 *  landing page (real fixture data), the paste page and anywhere a ReviewResult is at hand. */
export function ReviewCard({
  result,
  title,
  riskSlot,
  belowHeader,
}: {
  result: TReviewResult;
  title?: string;
  /** Replaces the static risk badge (the paste page puts the clickable fixes button here). */
  riskSlot?: ReactNode;
  belowHeader?: ReactNode;
}) {
  const findings = [
    ...result.inline.map((f) => fromFinding(f, result.mode === "pr" ? "inline" : undefined)),
    ...result.summarized.map((f) => fromFinding(f, result.mode === "pr" ? "summary" : undefined)),
  ];
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">
            {title ?? (result.prNumber ? `#${result.prNumber} ${result.prTitle ?? ""}` : "File review")}
          </p>
          {result.whatChanged && (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              <Inline text={result.whatChanged} />
            </p>
          )}
        </div>
        {riskSlot ?? <RiskBadge tier={result.riskTier} />}
      </div>
      {belowHeader}
      <FindingList findings={findings} empty="Nothing to flag. Sift stays quiet when the code is fine." />
      <details className="border-t border-line px-4 py-2.5 text-xs text-muted">
        <summary className="cursor-pointer select-none text-faint hover:text-text">
          What do severities mean?
        </summary>
        <dl className="mt-2 grid gap-1.5">
          {(Object.keys(SEVERITY_DEFINITIONS) as TSeverity[]).map((s) => (
            <div key={s} className="flex gap-3">
              <dt className="w-16 shrink-0 font-mono font-semibold uppercase">{s}</dt>
              <dd>{SEVERITY_DEFINITIONS[s]}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 font-mono text-xs text-faint">
        <span>{result.inline.length} ranked</span>
        <span>{result.summarized.length} folded</span>
        <span>{result.droppedCount} dropped as unverified</span>
        <span>{duration(result.stats.durationMs)}</span>
      </p>
    </Panel>
  );
}
