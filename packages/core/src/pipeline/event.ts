import { z } from "zod";

const Repo = z.object({ full_name: z.string() });

/** The parts of a `pull_request` webhook payload Sift reads. */
export const PrEvent = z.object({
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    draft: z.boolean().default(false),
    user: z.object({ login: z.string() }),
    requested_reviewers: z.array(z.object({ login: z.string() })).default([]),
    head: z.object({ sha: z.string(), ref: z.string(), repo: Repo.nullable() }),
    base: z.object({ sha: z.string(), ref: z.string(), repo: Repo }),
  }),
  repository: z.object({ name: z.string(), owner: z.object({ login: z.string() }) }),
});
export type TPrEvent = z.infer<typeof PrEvent>;

/**
 * Why this run should not review, or null to go ahead.
 * - Only `pull_request` events review (comment events are for feedback, T-20).
 * - Drafts are skipped (FR-07).
 * - Fork PRs get a read-only token, so posting would fail (TRD §8).
 */
export function skipReason(eventName: string | undefined, event: TPrEvent): string | null {
  if (eventName !== "pull_request") return `event "${eventName ?? "unknown"}" is not a pull_request`;
  const pr = event.pull_request;
  if (pr.draft) return "draft PR";
  if (pr.head.repo?.full_name !== pr.base.repo.full_name) return "fork PR: read-only token, skipping post";
  return null;
}
