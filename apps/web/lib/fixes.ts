// Turns a finding's `suggestion` into an edit of the user's own copy of the file (Try a file page).
import type { TFinding, TReviewResult } from "@sift/shared";

export type ApplyResult = { ok: true; content: string } | { ok: false; reason: "not-found" | "ambiguous" };

/** Findings with a concrete, different `suggestion`, in the order the review ranked them. */
export function fixable(result: Pick<TReviewResult, "inline" | "summarized">): TFinding[] {
  return [...result.inline, ...result.summarized].filter(
    (f) => f.suggestion && f.suggestion !== f.quotedCode,
  );
}

const eolOf = (s: string) => (s.includes("\r\n") ? "\r\n" : "\n");
const withEol = (s: string, eol: string) => s.replace(/\r?\n/g, eol);

/** A quote that starts with indentation but a fix that doesn't would pull the line to column 0. */
function keepIndent(quote: string, fix: string): string {
  const indent = /^[ \t]*/.exec(quote)?.[0] ?? "";
  return indent && !/^\s/.test(fix) ? indent + fix : fix;
}

/** Swap `quotedCode` for `suggestion`, only when the quote occurs exactly once (never guess). */
export function applySuggestion(content: string, quotedCode: string, suggestion: string): ApplyResult {
  const eol = eolOf(content);
  const quote = withEol(quotedCode, eol);
  const parts = content.split(quote);
  if (parts.length === 1) return { ok: false, reason: "not-found" };
  if (parts.length > 2) return { ok: false, reason: "ambiguous" };
  return { ok: true, content: parts.join(withEol(keepIndent(quotedCode, suggestion), eol)) };
}

/** Apply each finding in turn; findings whose quote is gone or repeated are reported, not forced. */
export function applyAll(
  content: string,
  findings: TFinding[],
): { content: string; applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  let current = content;
  for (const f of findings) {
    const res = applySuggestion(current, f.quotedCode, f.suggestion ?? "");
    if (res.ok) {
      current = res.content;
      applied.push(f.fingerprint);
    } else skipped.push(f.fingerprint);
  }
  return { content: current, applied, skipped };
}
