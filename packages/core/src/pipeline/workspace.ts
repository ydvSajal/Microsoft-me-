import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

/** Returns a file's lines, or null if it can't be read (missing, or outside the checkout). */
export type ReadFile = (path: string) => string[] | null | Promise<string[] | null>;

/** The Action's reader: files of the local checkout, refusing paths that escape it. */
export function workspaceReader(workspace: string): ReadFile {
  const root = resolve(workspace);
  return (file) => {
    const path = resolve(root, file);
    if (!path.startsWith(root + sep)) return null;
    try {
      return readFileSync(path, "utf8")
        .replace(/\r?\n$/, "")
        .split(/\r?\n/);
    } catch {
      return null;
    }
  };
}
