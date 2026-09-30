import { normalize } from "@sift/shared/fingerprint";

export type Placement = "inline" | "summary";
export type Grounded<T> = { finding: T; placement: Placement };

type Span = { start: number; end: number };

const squash = (line: string) => line.trim().replace(/\s+/g, " ");

/** Every place the quote occurs, ignoring whitespace differences and blank lines inside it. */
function findQuote(quote: string, fileLines: readonly string[]): Span[] {
  const want = normalize(quote).split("\n").filter(Boolean);
  if (want.length === 0) return [];
  // Non-blank file lines with their 1-based numbers, so a quote can span blank lines.
  const have = fileLines.map((text, i) => ({ text: squash(text), line: i + 1 })).filter((l) => l.text);

  const spans: Span[] = [];
  for (let i = 0; i + want.length <= have.length; i++) {
    // A single-line quote may be part of a line; each line of a multi-line quote must match within its line.
    if (want.every((w, k) => have[i + k]?.text.includes(w))) {
      spans.push({ start: have[i]?.line ?? 0, end: have[i + want.length - 1]?.line ?? 0 });
    }
  }
  return spans;
}

const distance = (line: number, s: Span) =>
  line < s.start ? s.start - line : line > s.end ? line - s.end : 0;

/**
 * Check a finding against the real file (TRD §4.3, FR-09).
 * - Quote not in the file → null (the model made it up; never posted anywhere).
 * - Otherwise the line snaps onto the nearest occurrence of the quote, and the finding is
 *   `inline` only if that occurrence touches a commentable (added) line; else `summary`.
 */
export function groundFinding<T extends { line: number; quotedCode: string }>(
  finding: T,
  fileLines: readonly string[],
  commentable: ReadonlySet<number>,
): Grounded<T> | null {
  const spans = findQuote(finding.quotedCode, fileLines);
  if (spans.length === 0) return null;

  const best = spans.reduce((a, b) => (distance(finding.line, b) < distance(finding.line, a) ? b : a));
  const inSpan = distance(finding.line, best) === 0;
  const candidates = [inSpan ? finding.line : best.start];
  for (let n = best.start; n <= best.end; n++) candidates.push(n);

  const onDiff = candidates.find((n) => commentable.has(n));
  if (onDiff !== undefined) return { finding: { ...finding, line: onDiff }, placement: "inline" };
  return { finding: { ...finding, line: candidates[0] ?? best.start }, placement: "summary" };
}
