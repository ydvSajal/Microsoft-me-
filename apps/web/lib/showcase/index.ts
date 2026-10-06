// Recorded reviews for the "Try an example" buttons: instant, no model call, no passcode.
// Re-record with `pnpm --filter web showcase:record` (needs the model key); showcase.test.ts keeps them honest.
import { ReviewResult, type TReviewResult } from "@sift/shared";
import cartTotals from "./cart-totals.json";
import formatHelpers from "./format-helpers.json";
import ordersApi from "./orders-api.json";

export type ShowcaseExample = {
  slug: string;
  label: string;
  blurb: string;
  filename: string;
  content: string;
  result: TReviewResult;
};

const load = (raw: Omit<ShowcaseExample, "result"> & { result: unknown }): ShowcaseExample => ({
  ...raw,
  result: ReviewResult.parse(raw.result),
});

export const SHOWCASE: readonly ShowcaseExample[] = [ordersApi, cartTotals, formatHelpers].map(load);
