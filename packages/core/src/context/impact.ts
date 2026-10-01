import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { TReviewResult } from "@sift/shared";
import { Node, Project } from "ts-morph";
import { IMPACT_REFS_PER_SYMBOL, SKIP_PATTERNS } from "../config";
import type { DiffMap } from "../diff/diff-map";

/** A use of a changed export in a file the PR doesn't touch. */
type ImpactRef = TReviewResult["impact"][number];
export type ImpactFinding = ImpactRef & {
  /** Trimmed source line of the use, shown to the model. */
  text: string;
  /** The file that declares the symbol. */
  declFile: string;
  /** True when the diff touches the symbol's signature (not just its body). */
  signatureChanged: boolean;
};

const CODE_FILE = /\.(ts|tsx|js|jsx)$/;
const FALLBACK_GLOBS = ["**/*.{ts,tsx,js,jsx}", "!**/node_modules/**", "!**/dist/**", "!**/.sift/**"];

/** A declaration whose references we look up: the declaration node, its name, and its line spans. */
type Unit = {
  symbol: string;
  name: Node;
  start: number;
  end: number;
  sigEnd: number;
  /** Line spans inside [start, end] that belong to something else (a class's methods). */
  holes: [number, number][];
};

function loadProject(root: string): Project {
  const tsConfigFilePath = resolve(root, "tsconfig.json");
  if (existsSync(tsConfigFilePath)) return new Project({ tsConfigFilePath });
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(
    FALLBACK_GLOBS.map((g) => (g.startsWith("!") ? `!${root}/${g.slice(1)}` : `${root}/${g}`)),
  );
  return project;
}

/** Last line of the signature: the line the body starts on, or the whole declaration if it has none. */
function signatureEnd(decl: Node): number {
  const fn = Node.isVariableDeclaration(decl) ? decl.getInitializer() : decl;
  const body =
    fn &&
    (Node.isFunctionDeclaration(fn) ||
      Node.isMethodDeclaration(fn) ||
      Node.isArrowFunction(fn) ||
      Node.isFunctionExpression(fn))
      ? fn.getBody()
      : undefined;
  return body ? body.getStartLineNumber() : decl.getEndLineNumber();
}

const unit = (symbol: string, decl: Node, name: Node, holes: Unit["holes"] = []): Unit => ({
  symbol,
  name,
  start: decl.getStartLineNumber(),
  end: decl.getEndLineNumber(),
  sigEnd: signatureEnd(decl),
  holes,
});

/** Exported functions, classes (per method), types and consts declared in `sf`. */
function exportedUnits(sf: ReturnType<Project["getSourceFileOrThrow"]>): Unit[] {
  const units: Unit[] = [];
  for (const [exportName, decls] of sf.getExportedDeclarations()) {
    for (const decl of decls) {
      if (decl.getSourceFile() !== sf) continue; // re-export of something declared elsewhere
      if (Node.isClassDeclaration(decl)) {
        const methods = decl.getMethods();
        for (const m of methods) units.push(unit(`${exportName}.${m.getName()}`, m, m.getNameNode()));
        // The class itself counts only for lines outside its methods (header, fields, constructor).
        const holes = methods.map((m): [number, number] => [m.getStartLineNumber(), m.getEndLineNumber()]);
        units.push(unit(exportName, decl, decl.getNameNode() ?? decl, holes));
      } else if (
        Node.isFunctionDeclaration(decl) ||
        Node.isInterfaceDeclaration(decl) ||
        Node.isTypeAliasDeclaration(decl) ||
        Node.isVariableDeclaration(decl)
      ) {
        units.push(unit(exportName, decl, decl.getNameNode() ?? decl));
      }
    }
  }
  return units;
}

/**
 * Uses, outside the diff, of exported symbols whose declaration the diff touches (TRD §4.8).
 * Needs a real checkout. ponytail: loads the whole project once; fine for demo-sized repos,
 * scope to the changed files' dependency closure if a big monorepo makes it slow.
 */
export function analyzeImpact(opts: {
  workspace: string;
  changedFiles: ReadonlySet<string>;
  diffMap: DiffMap;
}): ImpactFinding[] {
  const root = resolve(opts.workspace);
  const project = loadProject(root);
  const rel = (abs: string) => relative(root, abs).split(sep).join("/");
  const out: ImpactFinding[] = [];

  for (const [file, added] of opts.diffMap) {
    const sf = CODE_FILE.test(file) ? project.getSourceFile(resolve(root, file)) : undefined;
    if (!sf || added.size === 0) continue;
    const touches = (from: number, to: number, holes: Unit["holes"] = []) =>
      [...added].some((n) => n >= from && n <= to && !holes.some(([a, b]) => n >= a && n <= b));

    for (const u of exportedUnits(sf)) {
      if (!touches(u.start, u.end, u.holes) || !Node.isIdentifier(u.name)) continue;
      const seen = new Set<string>();
      const refs = u.name
        .findReferencesAsNodes()
        .filter(
          (ref) => !ref.getFirstAncestor((a) => Node.isImportDeclaration(a) || Node.isExportDeclaration(a)),
        )
        .map((ref) => ({ ref, path: rel(ref.getSourceFile().getFilePath()) }))
        .filter(({ path }) => !path.startsWith("..") && !opts.changedFiles.has(path))
        .filter(({ path }) => !SKIP_PATTERNS.some((p) => p.test(path)) && !path.includes("node_modules/"))
        .map(({ ref, path }) => ({ path, line: ref.getStartLineNumber(), ref }))
        .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
        .filter(({ path, line }) => !seen.has(`${path}:${line}`) && seen.add(`${path}:${line}`))
        .slice(0, IMPACT_REFS_PER_SYMBOL);

      for (const { path, line, ref } of refs) {
        out.push({
          symbol: u.symbol,
          file: path,
          line,
          text: (ref.getSourceFile().getFullText().split(/\r?\n/)[line - 1] ?? "").trim().slice(0, 200),
          declFile: file,
          signatureChanged: touches(u.start, u.sigEnd, u.holes),
        });
      }
    }
  }
  return out;
}

/** Model context for one file: where its changed exports are used elsewhere. */
export function impactContext(impact: readonly ImpactFinding[], file: string): string | undefined {
  const mine = impact.filter((i) => i.declFile === file);
  if (mine.length === 0) return undefined;
  const lines = mine.map((i) => `- ${i.symbol} is used at ${i.file}:${i.line}: ${i.text}`);
  return `Exports changed in this file that are used in files this PR does not touch:\n${lines.join("\n")}`;
}
