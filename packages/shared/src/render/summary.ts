// GitHub-flavoured markdown for the review body (the summary comment).
import type { TFinding, TReviewResult } from "../schemas";
import { clean, RISK_BADGE, SEVERITY_BADGE, where } from "./inline";

export type SummaryOptions = {
  /** Also list the inline findings (used when GitHub rejected the inline comments). */
  includeInline?: boolean;
  /** Stack layer identity (TRD §4.5), stored hidden so the next run can skip an unchanged layer. */
  patchId?: string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function bullet(f: TFinding): string {
  const also = f.alsoIn.length > 0 ? ` (also in ${f.alsoIn.map(where).join(", ")})` : "";
  return `- ${SEVERITY_BADGE[f.severity]} ${where(f)} — ${clean(f.title)}${also}`;
}

const details = (summary: string, lines: string[]) => [
  `<details><summary>${summary}</summary>`,
  "",
  ...lines,
  "",
  "</details>",
  "",
];

export function renderSummary(r: TReviewResult, opts: SummaryOptions = {}): string {
  const lines = [`### Sift review · risk ${RISK_BADGE[r.riskTier]}`, ""];
  if (r.whatChanged) lines.push(clean(r.whatChanged), "");

  if (r.inline.length === 0 && r.summarized.length === 0) {
    lines.push("Nothing to flag on the changed lines. 🎉", "");
  } else {
    lines.push(`**${plural(r.inline.length, "inline comment")}** · ${r.summarized.length} more below`, "");
  }
  if (opts.includeInline && r.inline.length > 0) {
    lines.push("#### Top findings", ...r.inline.map(bullet), "");
  }

  const nits = r.summarized.filter((f) => f.severity === "nit");
  const rest = r.summarized.filter((f) => f.severity !== "nit");
  if (rest.length > 0) lines.push("#### Also worth a look", ...rest.map(bullet), "");
  if (nits.length > 0) lines.push(...details(plural(nits.length, "nit"), nits.map(bullet)));

  if (r.impact.length > 0) {
    lines.push("#### Callers to check", ...r.impact.map((i) => `- \`${i.symbol}\` used at ${where(i)}`), "");
  }
  if (r.skippedFiles.length > 0) {
    const skipped = r.skippedFiles.map((s) => `- \`${s.file}\`: ${s.reason}`);
    lines.push(...details(`Not reviewed (${plural(r.skippedFiles.length, "file")})`, skipped));
  }

  const dropped = r.droppedCount > 0 ? ` · ${r.droppedCount} dropped as unverified or low-confidence` : "";
  lines.push(
    `<sub>Sift only comments; a human reviewer approves. ${plural(r.stats.llmCalls, "model call")} · ` +
      `${(r.stats.durationMs / 1000).toFixed(1)} s${dropped}</sub>`,
  );
  if (opts.patchId) lines.push(`<!-- sift:patch=${opts.patchId} -->`);
  return lines.join("\n");
}
