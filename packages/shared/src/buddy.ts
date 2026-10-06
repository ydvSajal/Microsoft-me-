// Buddy mood (TRD §6): the first matching rule wins. Pure, so the web buddy, the /review page
// and (later) the firmware route all agree.
import type { TBuddyState, TSeverity } from "./schemas";

export type BuddyFinding = { severity: TSeverity; title: string };
/** One PR still waiting on people: its latest review's open findings and how long it has waited. */
export type BuddyPr = { number: number; waitingHours: number; findings: BuddyFinding[] };

export type BuddyInput = {
  snoozed: boolean;
  /** PR number of a review in progress, if any. */
  reviewing: number | null;
  /** Newest first. */
  prs: BuddyPr[];
  waitHours: number;
  rev: number;
};

const TEXT_MAX = 40;
/** Finding titles are markdown; a speech bubble (or a 240px screen) shows plain text. */
const clip = (raw: string) => {
  const s = raw.replaceAll("`", "");
  return s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX - 1)}…` : s;
};
const label = (n: number) => (n > 0 ? `#${n}` : "this file");

export function computeBuddyState(input: BuddyInput): TBuddyState {
  const all = input.prs.flatMap((p) => p.findings);
  const count = (s: TSeverity) => all.filter((f) => f.severity === s).length;
  const base = {
    pending: input.prs.length,
    critical: count("critical"),
    high: count("high"),
    medium: count("medium"),
    buzz: false,
    rev: input.rev,
  };
  const state = (mood: TBuddyState["mood"], text: string, buzz = false): TBuddyState => ({
    ...base,
    mood,
    text: clip(text),
    buzz,
  });
  const first = (s: TSeverity) => all.find((f) => f.severity === s);

  if (input.snoozed) return state("sleepy", "Snoozed");
  if (input.reviewing !== null) return state("scanning", `Reviewing PR #${input.reviewing}…`);
  const critical = first("critical");
  if (critical) return state("angry", critical.title, true);
  const high = first("high");
  if (high) return state("worried", high.title);
  const late = input.prs.find((p) => p.waitingHours > input.waitHours);
  if (late) return state("impatient", `#${late.number} waiting ${Math.floor(late.waitingHours)}h`);
  const latest = input.prs[0];
  if (!latest) return state("sleepy", "Queue empty");
  const medium = latest.findings.filter((f) => f.severity === "medium").length;
  if (medium > 0) return state("meh", `${medium} medium on ${label(latest.number)}`);
  if (latest.findings.length > 0) return state("meh", `Only nits on ${label(latest.number)}`);
  return state("happy", `${label(latest.number)} looks clean`);
}

/** The buddy for one reviewed file on /review: same rules, a single "PR" numbered 0. */
export const buddyFromFindings = (findings: BuddyFinding[]): TBuddyState =>
  computeBuddyState({
    snoozed: false,
    reviewing: null,
    prs: [{ number: 0, waitingHours: 0, findings }],
    waitHours: Number.POSITIVE_INFINITY,
    rev: 0,
  });
