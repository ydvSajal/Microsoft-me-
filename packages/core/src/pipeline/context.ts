import type { Hunk } from "@sift/ai";
import { CONTEXT_LINES } from "../config";
import type { PatchHunk } from "../diff/parse-patch";

/**
 * Model input for one file: each changed range widened by `context` lines of the real file
 * (TRD §5, ±20), overlapping ranges merged, added lines flagged.
 */
export function contextHunks(
  patchHunks: readonly PatchHunk[],
  fileLines: readonly string[],
  context = CONTEXT_LINES,
): Hunk[] {
  const ranges = patchHunks
    .filter((h) => h.added.length > 0)
    .map((h) => ({
      start: Math.max(1, h.newStart - context),
      end: Math.min(fileLines.length, h.newEnd + context),
      added: h.added,
    }))
    .sort((a, b) => a.start - b.start);

  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
      last.added = [...last.added, ...r.added];
    } else merged.push({ ...r });
  }
  return merged.map((r) => ({
    startLine: r.start,
    lines: fileLines.slice(r.start - 1, r.end),
    added: r.added,
  }));
}

/** A few numbered lines around `line`, for the judge. */
export function snippet(fileLines: readonly string[], line: number, radius = 5): string {
  const start = Math.max(1, line - radius);
  const end = Math.min(fileLines.length, line + radius);
  return fileLines
    .slice(start - 1, end)
    .map((text, i) => `${start + i} | ${text}`)
    .join("\n");
}
