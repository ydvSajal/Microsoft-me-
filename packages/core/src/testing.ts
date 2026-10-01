// Test helpers shared by core's tests: fixtures and an in-memory GitHub. Never imported by src.
import { readFileSync } from "node:fs";
import type { PrFile } from "./diff/diff-map";
import type { GitHub, NewReview } from "./github/client";
import { PrEvent, type TPrEvent } from "./pipeline/event";

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
  opts: { failReviews?: { times: number; status: number }; posted?: string[] } = {},
) {
  const reviews: NewReview[] = [];
  let failures = opts.failReviews?.times ?? 0;
  const gh: GitHub = {
    listFiles: async () => files,
    listPostedBodies: async () => [
      ...(opts.posted ?? []),
      ...reviews.flatMap((r) => [r.body, ...r.comments.map((c) => c.body)]),
    ],
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
  return { gh, reviews };
}
