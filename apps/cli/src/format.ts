import { styleText } from "node:util";
import type { TFinding, TReviewResult, TSeverity } from "@sift/shared";

type Style = Parameters<typeof styleText>[0];
const SEVERITY_STYLE: Record<TSeverity, Style> = {
  critical: ["bold", "red"],
  high: "red",
  medium: "yellow",
  low: "cyan",
  nit: "gray",
};

/** Human-readable review for the terminal. `color: false` for plain text (pipes, tests). */
export function formatResult(file: string, r: TReviewResult, color: boolean): string {
  const paint = (style: Style, s: string) => (color ? styleText(style, s, { validateStream: false }) : s);
  const count = r.inline.length + r.summarized.length;
  const secs = (r.stats.durationMs / 1000).toFixed(1);
  const lines = [
    paint("bold", `Sift review · ${file}`),
    `Risk: ${paint(r.riskTier === "high" ? "red" : r.riskTier === "medium" ? "yellow" : "green", r.riskTier.toUpperCase())}` +
      ` · ${count} finding${count === 1 ? "" : "s"} · ${secs}s`,
    "",
  ];
  if (r.whatChanged) lines.push(r.whatChanged, "");

  if (r.stats.skippedReason) {
    lines.push(
      paint("yellow", "The model's answer couldn't be read twice in a row, so there are no findings."),
      "",
    );
  } else if (count === 0) {
    lines.push(paint("green", "No issues found. Looks clean."), "");
  }

  r.inline.forEach((f, i) => {
    lines.push(...formatFinding(i + 1, f, paint), "");
  });

  if (r.summarized.length > 0) {
    lines.push(paint("gray", `Nits (${r.summarized.length})`));
    for (const f of r.summarized) lines.push(paint("gray", `  - line ${f.line}: ${f.title}`));
    lines.push("");
  }
  if (r.droppedCount > 0) lines.push(paint("gray", `${r.droppedCount} unusable finding(s) dropped.`));
  return `${lines.join("\n").trimEnd()}\n`;
}

function formatFinding(n: number, f: TFinding, paint: (s: Style, t: string) => string): string[] {
  const out = [
    `${n}. ${paint(SEVERITY_STYLE[f.severity], f.severity.toUpperCase())} ${f.category} · line ${f.line}` +
      paint("gray", ` (${Math.round(f.confidence * 100)}% sure)`),
    `   ${paint("bold", f.title)}`,
    ...f.body.split("\n").map((l) => `   ${l}`),
  ];
  if (f.suggestion) {
    out.push(`   ${paint("green", "Suggestion:")}`, ...f.suggestion.split("\n").map((l) => `     ${l}`));
  }
  return out;
}
