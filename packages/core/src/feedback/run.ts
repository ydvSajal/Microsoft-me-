import type { GitHub } from "../github/client";
import type { Ingest } from "../ingest/client";
import { collectOutcomes, toFeedbackEvents } from "./collect";

/** Reads outcomes for Sift's comments on one PR and reports them. Never fails the caller. */
export async function reportFeedback(
  gh: GitHub,
  ingest: Ingest,
  repo: string,
  prNumber: number,
): Promise<number> {
  try {
    const [comments, resolved] = await Promise.all([
      gh.listComments(prNumber),
      gh.listResolvedThreadRoots(prNumber),
    ]);
    const events = toFeedbackEvents(collectOutcomes(comments, resolved), repo, prNumber);
    await ingest.feedback(events);
    return events.length;
  } catch (err) {
    console.log(`::warning::Feedback collection failed: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}
