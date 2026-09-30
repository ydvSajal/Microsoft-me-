import { parsePatch } from "./parse-patch";

/** The fields of GitHub's "list PR files" entries the pipeline reads. */
export type PrFile = {
  filename: string;
  status: string;
  patch?: string;
  previous_filename?: string;
};

/** file → RIGHT-side lines that may carry an inline comment (TRD §4.1). */
export type DiffMap = Map<string, Set<number>>;

/**
 * Commentable lines per file. Removed files and files without a patch (binary, or too large
 * for GitHub to return one) get an empty set. Renamed files are keyed by their new name.
 */
export function buildDiffMap(files: readonly PrFile[]): DiffMap {
  const map: DiffMap = new Map();
  for (const f of files) {
    const lines = new Set<number>();
    if (f.status !== "removed" && f.patch) {
      for (const hunk of parsePatch(f.patch)) for (const n of hunk.added) lines.add(n);
    }
    map.set(f.filename, lines);
  }
  return map;
}
