// GitHub-flavoured markdown for one inline comment (TRD §5 tone rules, §4.2 markers).
// Pure string functions: safe for the browser (paste page) and the Action alike.
import type { TFinding, TRiskTier, TSeverity } from "../schemas";

export const SEVERITY_BADGE: Record<TSeverity, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🔵 Low",
  nit: "⚪ Nit",
};

export const RISK_BADGE: Record<TRiskTier, string> = {
  high: "🔴 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
};

/** Hidden marker that lets the next push skip findings already posted (TRD §4.2). */
export const fpMarker = (fp: string) => `<!-- sift:fp=${fp} -->`;

/**
 * Model text is untrusted (it can echo PR content). Strip HTML comment delimiters so it can't
 * forge `sift:` markers, and break @-mentions so it can't ping people.
 */
export function clean(text: string): string {
  return text.replace(/<!--|-->/g, "").replace(/@(?=[\w-])/g, "@​");
}

/** Fenced code block whose fence is longer than any backtick run inside, so it can't be closed early. */
export function codeBlock(code: string, file: string): string {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const lang = /\.([a-z0-9]+)$/i.exec(file)?.[1] ?? "";
  return `${fence}${lang}\n${code}\n${fence}`;
}

export const where = (l: { file: string; line: number }) => `\`${l.file}:${l.line}\``;

export function renderInline(f: TFinding): string {
  const parts = [`**${SEVERITY_BADGE[f.severity]} · ${f.category}** — ${clean(f.title)}`, "", clean(f.body)];
  if (f.suggestion) parts.push("", "**Suggested fix:**", codeBlock(f.suggestion, f.file));
  if (f.alsoIn.length > 0) parts.push("", `Same issue also in ${f.alsoIn.map(where).join(", ")}.`);
  parts.push("", fpMarker(f.fingerprint));
  return parts.join("\n");
}
