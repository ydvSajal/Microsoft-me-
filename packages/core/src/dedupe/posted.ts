import type { Candidate } from "../rank/rank";

const FP_MARKER = /<!-- sift:fp=([0-9a-f]{12}) -->/g;

/** Fingerprints of everything Sift already posted, read back from its hidden markers (TRD §4.2). */
export function postedFingerprints(bodies: readonly string[]): Set<string> {
  return new Set(bodies.flatMap((b) => [...b.matchAll(FP_MARKER)].map((m) => m[1] as string)));
}

/** Drop findings an earlier push already posted, so a re-push never repeats a comment. */
export function dropPosted(candidates: readonly Candidate[], posted: ReadonlySet<string>) {
  const fresh = candidates.filter((c) => !posted.has(c.finding.fingerprint));
  return { fresh, repeats: candidates.length - fresh.length };
}
