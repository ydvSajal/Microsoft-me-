import { readFileSync } from "node:fs";
import type { TFinding } from "@sift/shared";
import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import { JUDGE_TEMPERATURE } from "./config";
import { withFallback } from "./provider";

const INSTRUCTIONS = readFileSync(new URL("./prompts/judge.md", import.meta.url), "utf8");

/** A finding plus the code around it, so the judge can check it against reality. */
export type JudgeItem = Pick<
  TFinding,
  "fingerprint" | "file" | "line" | "severity" | "category" | "title" | "body" | "quotedCode"
> & { code: string };

export type JudgeOutput = {
  /** fingerprint → re-scored confidence. Missing entries keep their original confidence. */
  scores: Map<string, number>;
  llmCalls: number;
  error?: string;
};

const JudgeSchema = z.object({
  scores: z.array(z.object({ fingerprint: z.string(), confidence: z.number() })),
});

function buildPrompt(items: readonly JudgeItem[]): string {
  const blocks = items.map(({ code, ...f }) =>
    [
      `### fingerprint: ${f.fingerprint}`,
      `${f.severity} ${f.category} at ${f.file}:${f.line}: ${f.title}`,
      f.body,
      `Quoted code: ${f.quotedCode}`,
      "Code around it:",
      code,
    ].join("\n"),
  );
  return ["<findings>", ...blocks, "</findings>"].join("\n\n");
}

/**
 * One batched call that re-scores every finding's confidence (TRD §5). It can only rate
 * findings it was given; any failure returns no scores, so the original confidences stand.
 */
export async function judge(
  items: readonly JudgeItem[],
  deps: { model?: LanguageModel } = {},
): Promise<JudgeOutput> {
  if (items.length === 0) return { scores: new Map(), llmCalls: 0 };
  const known = new Set(items.map((i) => i.fingerprint));
  try {
    const { output } = await withFallback(
      "judge",
      (model) =>
        generateText({
          model,
          instructions: INSTRUCTIONS,
          prompt: buildPrompt(items),
          temperature: JUDGE_TEMPERATURE,
          output: Output.object({ schema: JudgeSchema }),
        }),
      deps,
    );
    const scores = new Map<string, number>();
    for (const s of output.scores) {
      if (known.has(s.fingerprint) && Number.isFinite(s.confidence)) {
        scores.set(s.fingerprint, Math.min(1, Math.max(0, s.confidence)));
      }
    }
    return { scores, llmCalls: 1 };
  } catch (err) {
    return { scores: new Map(), llmCalls: 1, error: err instanceof Error ? err.message : String(err) };
  }
}
