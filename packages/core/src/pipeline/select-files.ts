import { MAX_FILES, SKIP_PATTERNS } from "../config";
import type { PrFile } from "../diff/diff-map";

const REVIEWABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export type SkippedFile = { file: string; reason: string };

/**
 * Which changed files go to the model (NFR-02). Removed files are ignored silently; everything
 * else not reviewed is listed with a reason so the summary can say what Sift didn't look at.
 */
export function selectFiles(files: readonly PrFile[]): { review: PrFile[]; skipped: SkippedFile[] } {
  const review: PrFile[] = [];
  const skipped: SkippedFile[] = [];
  for (const f of files) {
    if (f.status === "removed") continue;
    const reason = SKIP_PATTERNS.some((p) => p.test(f.filename))
      ? "generated, vendored or binary"
      : !REVIEWABLE.test(f.filename)
        ? "not TypeScript/JavaScript"
        : !f.patch
          ? "no diff from GitHub (binary or too large)"
          : review.length >= MAX_FILES
            ? `over the ${MAX_FILES}-file limit`
            : null;
    if (reason) skipped.push({ file: f.filename, reason });
    else review.push(f);
  }
  return { review, skipped };
}
