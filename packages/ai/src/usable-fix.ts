// Publication gate for a finding's `suggestion` (the code that "Apply" swaps in).
// A right diagnosis with an empty, unchanged or broken fix reads as Sift's mistake, so such a
// fix is removed and the finding is kept without one. Checks are about the text itself only;
// "does this read as prose?" is deliberately not judged (no reliable rule for it).

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

const PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
// A `/` after one of these (or at the start) opens a regex literal, not a division.
const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]$/;

function isDiffHunk(code: string): boolean {
  const lines = code.split(/\r?\n/).filter((l) => l.trim());
  if (lines.some((l) => l.startsWith("@@"))) return true;
  return lines.length > 1 && lines.every((l) => /^[+-]/.test(l));
}

/** Brackets pair up and every string, template and comment is closed. */
function isBalanced(code: string): boolean {
  const stack: string[] = [];
  let i = 0;
  const skipUntil = (end: string) => {
    while (i < code.length && code[i] !== end) i += code[i] === "\\" ? 2 : 1;
    return i < code.length;
  };
  while (i < code.length) {
    const c = code[i] as string;
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end < 0) return false;
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      i++;
      if (!skipUntil(c)) return false;
    } else if (c === "/" && REGEX_PREFIX.test(code.slice(0, i).trimEnd() || "(")) {
      i++;
      if (!skipUntil("/")) return false;
    } else if (c === "(" || c === "[" || c === "{") stack.push(c);
    else if (c in PAIRS && stack.pop() !== PAIRS[c]) return false;
    i++;
  }
  return stack.length === 0;
}

/** False when the fix is empty, the same as the quoted code, a diff hunk, or cut off mid-statement. */
export function isUsableFix(quotedCode: string, suggestion: string | undefined): boolean {
  if (!suggestion?.trim()) return false;
  if (squash(suggestion) === squash(quotedCode)) return false;
  if (isDiffHunk(suggestion)) return false;
  // A quote that is itself a fragment (e.g. `if (x) {`) legitimately gets a fragment back.
  return !isBalanced(quotedCode) || isBalanced(suggestion);
}
