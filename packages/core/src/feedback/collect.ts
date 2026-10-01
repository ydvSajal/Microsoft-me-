import type { FeedbackEvent } from "@sift/shared";
import type { z } from "zod";

type TFeedbackEvent = z.infer<typeof FeedbackEvent>;
type Outcome = TFeedbackEvent["outcome"];
type Source = TFeedbackEvent["source"];

/** A review comment on the PR, as feedback collection needs it. */
export type PrComment = {
  id: number;
  body: string;
  /** null when GitHub marks the comment outdated: the line it was on has since changed. */
  line: number | null;
  inReplyTo: number | null;
  author: string;
  isBot: boolean;
  reactions: { up: number; down: number };
};

const FP = /<!-- sift:fp=([0-9a-f]{12}) -->/;
const COMMAND = /^\s*\/sift\s+(accept|ignore)\b/im;

/**
 * One outcome per Sift inline comment from the signals in TRD §4.6. When several apply, the
 * most deliberate wins: a `/sift` reply, then reactions, then the line changing, then a
 * thread resolved without a change.
 */
export function collectOutcomes(
  comments: readonly PrComment[],
  resolvedRoots: ReadonlySet<number>,
): { fingerprint: string; outcome: Outcome; source: Source }[] {
  const replies = new Map<number, PrComment[]>();
  for (const c of comments) {
    if (c.inReplyTo !== null) replies.set(c.inReplyTo, [...(replies.get(c.inReplyTo) ?? []), c]);
  }

  const out: { fingerprint: string; outcome: Outcome; source: Source }[] = [];
  for (const root of comments) {
    const fingerprint = root.inReplyTo === null ? FP.exec(root.body)?.[1] : undefined;
    if (!fingerprint) continue;

    // The newest human command in the thread counts.
    const command = (replies.get(root.id) ?? [])
      .filter((r) => !r.isBot)
      .map((r) => COMMAND.exec(r.body)?.[1])
      .filter(Boolean)
      .at(-1);
    const { up, down } = root.reactions;

    if (command === "accept") out.push({ fingerprint, outcome: "accepted", source: "command-accept" });
    else if (command === "ignore") out.push({ fingerprint, outcome: "dismissed", source: "command-ignore" });
    else if (up > down) out.push({ fingerprint, outcome: "accepted", source: "reaction-up" });
    else if (down > up) out.push({ fingerprint, outcome: "dismissed", source: "reaction-down" });
    else if (root.line === null) out.push({ fingerprint, outcome: "accepted", source: "line-changed" });
    else if (resolvedRoots.has(root.id))
      out.push({ fingerprint, outcome: "dismissed", source: "resolved-unchanged" });
  }
  return out;
}

/** Adds the PR identity and a timestamp, giving the ingest API's FeedbackEvent shape. */
export const toFeedbackEvents = (
  outcomes: ReturnType<typeof collectOutcomes>,
  repo: string,
  prNumber: number,
  at = new Date(),
): TFeedbackEvent[] => outcomes.map((o) => ({ ...o, repo, prNumber, at: at.toISOString() }));
