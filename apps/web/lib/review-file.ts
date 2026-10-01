import { buildFileResult, type LanguageModel, REVIEWABLE_FILE, reviewHunks } from "@sift/ai";
import type { TReviewResult } from "@sift/shared";
import { z } from "zod";
import { REVIEW_FILE_MAX_LINES } from "./config";

const toLines = (content: string) => content.replace(/\r?\n$/, "").split(/\r?\n/);

/** Paste page input (TRD §7): a TS/JS file of at most REVIEW_FILE_MAX_LINES lines. */
export const ReviewFileInput = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(REVIEWABLE_FILE, "Sift reviews TypeScript/JavaScript files (.ts, .tsx, .js, .jsx …)"),
  content: z
    .string()
    .min(1, "Paste some code")
    .refine((c) => toLines(c).length <= REVIEW_FILE_MAX_LINES, `At most ${REVIEW_FILE_MAX_LINES} lines`),
});

/** Same path as `sift review <file>`: one model call over the whole file, ranked file-mode result. */
export async function reviewFile(
  input: z.infer<typeof ReviewFileInput>,
  deps: { model?: LanguageModel } = {},
): Promise<TReviewResult> {
  const started = performance.now();
  // The pasted code is data for the model; reviewHunks' prompt already says so.
  const out = await reviewHunks(
    { file: input.filename, hunks: [{ startLine: 1, lines: toLines(input.content) }] },
    { model: deps.model },
  );
  return buildFileResult(out, performance.now() - started);
}
