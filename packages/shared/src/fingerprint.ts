// Separate entry (`@sift/shared/fingerprint`) so browser bundles never pull in node:crypto.
import { createHash } from "node:crypto";

/** Trim each line, collapse whitespace runs, drop empty lines (TRD §4.2). */
export function normalize(code: string): string {
  return code
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

/** Stable 12-char id for a finding: same issue on the same code → same fingerprint. */
export function fingerprint(f: { category: string; ruleKey: string; quotedCode: string }): string {
  return createHash("sha1")
    .update(`${f.category}:${f.ruleKey}:${normalize(f.quotedCode)}`)
    .digest("hex")
    .slice(0, 12);
}
