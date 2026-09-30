// ponytail: minimal markdown so reviews are readable now; T-11 replaces this with the shared,
// snapshot-tested renderers (badges, <details> nits, friendly copy).
import type { TFinding, TReviewResult } from "@sift/shared";

export const fpMarker = (fp: string) => `<!-- sift:fp=${fp} -->`;

export function inlineBody(f: TFinding): string {
  const parts = [`**${f.severity.toUpperCase()} · ${f.category}**: ${f.title}`, "", f.body];
  if (f.suggestion) parts.push("", "Suggested fix:", "```ts", f.suggestion, "```");
  parts.push("", fpMarker(f.fingerprint));
  return parts.join("\n");
}

const bullet = (f: TFinding) => `- \`${f.file}:${f.line}\` **${f.severity}** ${f.title}`;

/** Review body. `includeInline` lists the inline findings too (used when inline posting failed). */
export function summaryBody(r: TReviewResult, includeInline = false): string {
  const lines = [`### Sift review · risk: **${r.riskTier.toUpperCase()}**`, ""];
  if (r.whatChanged) lines.push(r.whatChanged, "");
  lines.push(
    `${r.inline.length} inline comment(s) · ${r.summarized.length} more below · ${r.droppedCount} dropped as unverified or low-confidence`,
    "",
  );
  if (includeInline && r.inline.length > 0) {
    lines.push("#### Top findings", ...r.inline.map(bullet), "");
  }
  if (r.summarized.length > 0) {
    lines.push("#### Also worth a look (off the changed lines, over the budget, or nits)");
    lines.push(...r.summarized.map(bullet), "");
  }
  if (r.skippedFiles.length > 0) {
    lines.push("#### Not reviewed", ...r.skippedFiles.map((s) => `- \`${s.file}\`: ${s.reason}`), "");
  }
  lines.push("<sub>Sift only comments. A human reviewer approves.</sub>");
  return lines.join("\n");
}
