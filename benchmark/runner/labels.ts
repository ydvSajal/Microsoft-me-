// benchmark/labels.json: the ground truth, committed BEFORE any run (PRD §6 method).
import { z } from "zod";

const Spot = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  /** Inclusive end, for issues that span lines. */
  lineEnd: z.number().int().positive().optional(),
  note: z.string(),
});

export const LabeledPr = z.object({
  pr: z.number().int().positive(),
  kind: z.enum(["seeded-bug", "clean-refactor", "nit-heavy", "stack"]),
  /** Seeded bugs: what recall is measured against. */
  bugs: z.array(Spot).default([]),
  /** Other real, actionable issues a correct comment may point at (counts for precision only). */
  acceptable: z.array(Spot).default([]),
});

export const Labels = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  prs: z.array(LabeledPr).min(1),
});

export type TLabels = z.infer<typeof Labels>;
export type TLabeledPr = z.infer<typeof LabeledPr>;
export type Spot = z.infer<typeof Spot>;
