// Test helpers shared by core's tests: fixtures and an in-memory GitHub. Never imported by src.
import { readFileSync } from "node:fs";
import type { PrFile } from "./diff/diff-map";
import type { GitHub, NewReview } from "./github/client";
import { PrEvent, type TPrEvent } from "./pipeline/event";
import type { PrComment } from "./feedback/collect";
import type { OpenPr } from "./stack/stack";

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../shared/src/fixtures/${name}`, import.meta.url), "utf8"));
}

export const prEvent = (): TPrEvent => PrEvent.parse(loadFixture("pr-event.json"));

/**
 * In-memory GitHub: serves `files`, records every review. `failReviews` makes the first N posts throw.
 * `posted` seeds bodies from earlier pushes; reviews posted through the fake are listed back too.
 */
export function fakeGitHub(
  files: PrFile[],
  opts: {
    failReviews?: { times: number; status: number };
    posted?: string[];
    labels?: string[];
    failLabels?: boolean;
    /** Open PRs for stack detection, and what Sift posted on each of the other PRs. */
    openPrs?: OpenPr[];
    postedByPr?: Record<number, string[]>;
    comments?: PrComment[];
    resolvedRoots?: number[];
  } = {},
) {
  const labels = new Set(opts.labels ?? []);
  const reviews: NewReview[] = [];
  let failures = opts.failReviews?.times ?? 0;
  const gh: GitHub = {
    listFiles: async () => files,
    listOpenPrs: async () => opts.openPrs ?? [],
    listComments: async () => opts.comments ?? [],
    listResolvedThreadRoots: async () => new Set(opts.resolvedRoots ?? []),
    listPostedBodies: async (pr) =>
      opts.postedByPr?.[pr] ?? [
        ...(opts.posted ?? []),
        ...reviews.flatMap((r) => [r.body, ...r.comments.map((c) => c.body)]),
      ],
    syncLabels: async (_pr, { add, remove }) => {
      if (opts.failLabels)
        throw Object.assign(new Error("Resource not accessible by integration"), { status: 403 });
      for (const name of remove) labels.delete(name);
      labels.add(add.name);
    },
    createReview: async (_pr, review) => {
      if (failures > 0) {
        failures--;
        throw Object.assign(new Error("Unprocessable Entity: line must be part of the diff"), {
          status: opts.failReviews?.status,
        });
      }
      reviews.push(review);
    },
  };
  return { gh, reviews, labels };
}
