import { execFileSync } from "node:child_process";
import type { TReviewResult, TRiskTier } from "@sift/shared";
import { PATCH_ID_MAX_BUFFER } from "../config";
import { postedFingerprints } from "../dedupe/posted";
import { RISK_LABELS } from "../risk/risk";

/** An open PR, as far as stack detection needs it. */
export type OpenPr = { number: number; title: string; headRef: string; baseRef: string; labels: string[] };
type StackLayer = NonNullable<TReviewResult["stack"]>[number];

/**
 * The stack `current` belongs to, bottom to top (TRD §4.5): a PR is stacked on another open PR
 * when its base branch is that PR's head branch.
 * ponytail: if two PRs are stacked on one head, the lower PR number wins; real forks of a stack are rare.
 */
export function detectStack(open: readonly OpenPr[], current: OpenPr): OpenPr[] {
  const all = [...open.filter((p) => p.number !== current.number), current].sort(
    (a, b) => a.number - b.number,
  );
  const seen = new Set([current.number]);
  const walk = (from: OpenPr, next: (p: OpenPr, from: OpenPr) => boolean): OpenPr[] => {
    const chain: OpenPr[] = [];
    for (let cur = from; ; ) {
      const step = all.find((p) => !seen.has(p.number) && next(p, cur));
      if (!step) return chain;
      seen.add(step.number);
      chain.push(step);
      cur = step;
    }
  };
  const below = walk(current, (p, cur) => p.headRef === cur.baseRef).reverse();
  const above = walk(current, (p, cur) => p.baseRef === cur.headRef);
  return [...below, current, ...above];
}

/** The tier a PR's `sift:risk-*` label says, or null if Sift hasn't labelled it. */
export function tierFromLabels(labels: readonly string[]): TRiskTier | null {
  const i = RISK_LABELS.findIndex((l) => labels.includes(l));
  return (["high", "medium", "low"] as const)[i] ?? null;
}

/**
 * The stack risk map for the summary. The current layer uses this run's result; others use their
 * label and the fingerprints Sift already posted there. A layer Sift hasn't labelled is `skipped`.
 */
export function stackLayers(
  layers: readonly OpenPr[],
  current: { number: number; riskTier: TRiskTier; findings: number },
  bodiesByPr: ReadonlyMap<number, readonly string[]>,
): StackLayer[] {
  return layers.map((l) => {
    if (l.number === current.number) {
      return { prNumber: l.number, riskTier: current.riskTier, findings: current.findings, skipped: false };
    }
    const tier = tierFromLabels(l.labels);
    return {
      prNumber: l.number,
      riskTier: tier ?? "low",
      findings: postedFingerprints(bodiesByPr.get(l.number) ?? []).size,
      skipped: tier === null,
    };
  });
}

const PATCH_MARKER = /<!-- sift:patch=([0-9a-f]+) -->/g;

/** The patch-id recorded in the newest Sift summary, if any. */
export function lastPatchId(bodies: readonly string[]): string | null {
  const ids = bodies.flatMap((b) => [...b.matchAll(PATCH_MARKER)].map((m) => m[1] as string));
  return ids.at(-1) ?? null;
}

/** `git patch-id --stable` output is "<patch-id> <commit-id>"; empty for an empty diff. */
export const parsePatchId = (out: string): string | null =>
  /^([0-9a-f]{8,64})\b/.exec(out.trim())?.[1] ?? null;

/** Identity of one layer's own diff, stable across rebases of the layers below it. */
export type PatchId = (baseSha: string, headSha: string) => string | null;

/** Needs both commits in the checkout (the Action uses `fetch-depth: 0`). Any git failure → no id. */
export function gitPatchId(workspace: string): PatchId {
  return (baseSha, headSha) => {
    try {
      const diff = execFileSync("git", ["diff", `${baseSha}...${headSha}`], {
        cwd: workspace,
        maxBuffer: PATCH_ID_MAX_BUFFER,
      });
      const out = execFileSync("git", ["patch-id", "--stable"], { cwd: workspace, input: diff });
      return parsePatchId(out.toString("utf8"));
    } catch {
      return null;
    }
  };
}
