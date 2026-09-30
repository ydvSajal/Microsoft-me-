/** One `@@` hunk, in RIGHT-side (new file) line numbers. */
export type PatchHunk = {
  newStart: number;
  /** Last new-file line the hunk covers; `newStart - 1` for a deletion-only hunk. */
  newEnd: number;
  /** Added lines: the only lines GitHub accepts inline comments on. */
  added: number[];
};

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parse a unified diff patch (as returned by GitHub's "list PR files") into hunks.
 * `+` lines are added and advance the new-file counter; context lines advance it;
 * `-` lines and `\ No newline at end of file` markers don't.
 */
export function parsePatch(patch: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let current: PatchHunk | null = null;
  let line = 0;

  for (const raw of patch.replace(/\n$/, "").split("\n")) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      line = Number(header[1]);
      current = { newStart: line, newEnd: line - 1, added: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue; // anything before the first header (e.g. "diff --git")

    const marker = raw[0];
    if (marker === "-" || marker === "\\") continue;
    if (marker === "+") current.added.push(line);
    current.newEnd = line;
    line++;
  }
  return hunks;
}
