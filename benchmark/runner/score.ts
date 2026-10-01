// Pure scoring for PRD §6. No I/O: the runner feeds it what each reviewer posted.
import type { Spot, TLabeledPr } from "./labels";

/** A comment within this many lines of a labelled spot points at it. */
export const LINE_TOLERANCE = 3;

export type Posted = { file: string; line: number; fingerprint: string };

/** What one reviewer did on one PR in one run. */
export type PrRun = {
  pr: TLabeledPr;
  /** Inline comments it would post. */
  posted: Posted[];
  /** Everything it reported (inline + summary); recall counts these. */
  reported: Posted[];
  /** Commentable lines per file (the diff map). */
  diff: ReadonlyMap<string, ReadonlySet<number>>;
  latencyMs: number;
  llmCalls: number;
  /** Stack PRs only: the same PR reviewed again with nothing changed. */
  rerun?: { posted: number; llmCalls: number };
};

const hits = (p: Posted, s: Spot) =>
  p.file === s.file && p.line >= s.line - LINE_TOLERANCE && p.line <= (s.lineEnd ?? s.line) + LINE_TOLERANCE;

export function scorePr(r: PrRun) {
  const spots = [...r.pr.bugs, ...r.pr.acceptable];
  const correct = r.posted.filter((p) => spots.some((s) => hits(p, s))).length;
  const found = r.pr.bugs.filter((b) => r.reported.some((p) => hits(p, b))).length;
  return {
    posted: r.posted.length,
    correct,
    bugs: r.pr.bugs.length,
    found,
    offDiff: r.posted.filter((p) => !r.diff.get(p.file)?.has(p.line)).length,
    duplicates: r.posted.length - new Set(r.posted.map((p) => p.fingerprint)).size,
    cleanComments: r.pr.kind === "clean-refactor" ? r.posted.length : 0,
    latencyMs: r.latencyMs,
    rerunPosted: r.rerun?.posted,
    rerunLlmCalls: r.rerun?.llmCalls,
  };
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

/** One run over every labelled PR, rolled up to the PRD §6 metrics. */
export function scoreRun(prs: readonly PrRun[]) {
  const s = prs.map(scorePr);
  const reruns = s.filter((x) => x.rerunPosted !== undefined);
  return {
    precision: ratio(sum(s.map((x) => x.correct)), sum(s.map((x) => x.posted))),
    recall: ratio(sum(s.map((x) => x.found)), sum(s.map((x) => x.bugs))),
    inlinePerPr: median(s.map((x) => x.posted)),
    offDiff: sum(s.map((x) => x.offDiff)),
    duplicates: sum(s.map((x) => x.duplicates)),
    cleanComments: sum(s.map((x) => x.cleanComments)),
    rerunPosted: reruns.length ? sum(reruns.map((x) => x.rerunPosted ?? 0)) : null,
    rerunLlmCalls: reruns.length ? sum(reruns.map((x) => x.rerunLlmCalls ?? 0)) : null,
    latencyMs: median(s.map((x) => x.latencyMs)),
  };
}

export type RunScore = ReturnType<typeof scoreRun>;

/** Median of each metric across runs (PRD §6: 3 runs per reviewer, report medians). */
export function medianScore(runs: readonly RunScore[]): RunScore {
  const pick = (k: keyof RunScore) => median(runs.map((r) => r[k]).filter((v): v is number => v !== null));
  return {
    precision: pick("precision"),
    recall: pick("recall"),
    inlinePerPr: pick("inlinePerPr"),
    offDiff: pick("offDiff") ?? 0,
    duplicates: pick("duplicates") ?? 0,
    cleanComments: pick("cleanComments") ?? 0,
    rerunPosted: pick("rerunPosted"),
    rerunLlmCalls: pick("rerunLlmCalls"),
    latencyMs: pick("latencyMs"),
  };
}
