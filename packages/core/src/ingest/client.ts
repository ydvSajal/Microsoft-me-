import { Category, type FeedbackEvent, type TCategory, type TReviewResult } from "@sift/shared";
import { z } from "zod";
import { INGEST_TIMEOUT_MS } from "../config";

type Started = { repo: string; prNumber: number; headSha: string };

/** Reports to the web app (TRD §7). Never throws: posting the review on GitHub always comes first. */
export type Ingest = {
  reviewStarted(e: Started): Promise<void>;
  review(r: TReviewResult): Promise<void>;
  feedback(events: z.infer<typeof FeedbackEvent>[]): Promise<void>;
  /** Muted categories for this repo; empty when the API can't be reached. */
  config(owner: string, name: string): Promise<TCategory[]>;
};

const ConfigResponse = z.object({ muted: z.array(z.string()) });
const warn = (what: string, err: unknown) =>
  console.log(`::warning::Sift API ${what} failed: ${err instanceof Error ? err.message : String(err)}`);

export function createIngest(baseUrl: string, secret: string, fetchImpl: typeof fetch = fetch): Ingest {
  const base = baseUrl.replace(/\/+$/, "");
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res;
  }
  const post = async (what: string, path: string, body: unknown) => {
    try {
      await call(path, { method: "POST", body: JSON.stringify(body) });
    } catch (err) {
      warn(what, err);
    }
  };

  return {
    reviewStarted: (e) => post("review-started", "/api/ingest/review-started", e),
    review: (r) => post("review", "/api/ingest/review", r),
    feedback: async (events) => {
      if (events.length > 0) await post("feedback", "/api/ingest/feedback", events);
    },
    async config(owner, name) {
      try {
        const res = await call(`/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/config`);
        const { muted } = ConfigResponse.parse(await res.json());
        return muted.flatMap((c) => (Category.safeParse(c).success ? [c as TCategory] : []));
      } catch (err) {
        warn("config", err);
        return [];
      }
    },
  };
}
