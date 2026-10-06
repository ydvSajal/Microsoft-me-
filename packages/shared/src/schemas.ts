import { z } from "zod";

export const Severity = z.enum(["critical", "high", "medium", "low", "nit"]);
export const Category = z.enum([
  "security",
  "bug",
  "breaking-change",
  "performance",
  "error-handling",
  "naming",
  "style",
  "convention",
  "test",
  "docs",
]);
export const RiskTier = z.enum(["high", "medium", "low"]);

export const Location = z.object({ file: z.string(), line: z.number().int().positive() });

export const Finding = z.object({
  fingerprint: z.string().length(12), // set by fingerprint(), see TRD §4.2
  file: z.string(),
  line: z.number().int().positive(),
  severity: Severity,
  category: Category,
  ruleKey: z.string().regex(/^[a-z0-9-]{3,40}$/), // e.g. "missing-await", "unclear-name"
  title: z.string().max(80),
  body: z.string().max(600), // friendly, specific explanation
  suggestion: z.string().max(600).optional(), // concrete fix
  quotedCode: z.string().min(1).max(400), // exact code the finding refers to
  confidence: z.number().min(0).max(1),
  alsoIn: z.array(Location).default([]),
});

// What the model returns (before core adds fingerprint/alsoIn)
export const ModelFinding = Finding.omit({ fingerprint: true, alsoIn: true });

export const ImpactRef = z.object({ symbol: z.string(), file: z.string(), line: z.number().int() });

export const StackLayer = z.object({
  prNumber: z.number().int(),
  riskTier: RiskTier,
  findings: z.number().int(),
  skipped: z.boolean(),
});

export const ReviewResult = z.object({
  mode: z.enum(["pr", "file"]),
  repo: z.string().optional(), // "owner/name"
  prNumber: z.number().int().optional(),
  prTitle: z.string().optional(),
  author: z.string().optional(),
  requestedReviewers: z.array(z.string()).default([]),
  headSha: z.string().optional(),
  riskTier: RiskTier,
  whatChanged: z.string().max(400),
  inline: z.array(Finding),
  summarized: z.array(Finding),
  droppedCount: z.number().int(),
  impact: z.array(ImpactRef).default([]),
  stack: z.array(StackLayer).optional(),
  skippedFiles: z.array(z.object({ file: z.string(), reason: z.string() })).default([]),
  stats: z.object({
    llmCalls: z.number().int(),
    durationMs: z.number().int(),
    skippedReason: z.string().optional(),
  }),
});

export const FeedbackEvent = z.object({
  repo: z.string(),
  prNumber: z.number().int(),
  fingerprint: z.string().length(12),
  outcome: z.enum(["accepted", "dismissed"]),
  source: z.enum([
    "line-changed",
    "reaction-up",
    "reaction-down",
    "command-accept",
    "command-ignore",
    "resolved-unchanged",
  ]),
  at: z.string().datetime(),
});

export const ReviewStarted = z.object({ repo: z.string(), prNumber: z.number().int(), headSha: z.string() });

export const Mood = z.enum(["sleepy", "scanning", "happy", "meh", "worried", "angry", "impatient"]);
export const BuddyState = z.object({
  mood: Mood,
  text: z.string().max(40),
  pending: z.number().int(),
  // Findings in the latest reviews by severity; the web buddy panel shows them as tiles.
  critical: z.number().int(),
  high: z.number().int(),
  medium: z.number().int(),
  buzz: z.boolean(),
  rev: z.number().int(),
});

export type TSeverity = z.infer<typeof Severity>;
export type TCategory = z.infer<typeof Category>;
export type TRiskTier = z.infer<typeof RiskTier>;
export type TFinding = z.infer<typeof Finding>;
export type TModelFinding = z.infer<typeof ModelFinding>;
export type TReviewResult = z.infer<typeof ReviewResult>;
export type TBuddyState = z.infer<typeof BuddyState>;
