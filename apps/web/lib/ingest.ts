// Writes what the Action reports (TRD §7) into Postgres. Pure mapping is split out for tests.
import type {
  FeedbackEvent,
  ReviewStarted,
  TFinding,
  TReviewResult,
  TRiskTier,
  TSeverity,
} from "@sift/shared";
import type { z } from "zod";
import type { PrismaClient } from "./generated/prisma/client";
import type { Outcome, Placement, RiskTier, Severity } from "./generated/prisma/enums";

export const toRisk = (t: TRiskTier) => t.toUpperCase() as RiskTier;
export const toSeverity = (s: TSeverity) => s.toUpperCase() as Severity;

/** "owner/name" → parts; null when malformed. */
export function splitRepo(full: string): { owner: string; name: string } | null {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(full);
  if (!m || m.slice(1).some((part) => /^\.+$/.test(part))) return null;
  return { owner: m[1] as string, name: m[2] as string };
}

const findingRow = (f: TFinding, placement: Placement) => ({
  fingerprint: f.fingerprint,
  file: f.file,
  line: f.line,
  severity: toSeverity(f.severity),
  category: f.category,
  ruleKey: f.ruleKey,
  title: f.title,
  confidence: f.confidence,
  placement,
});

/** The Review row and its findings for one ReviewResult. */
export function reviewRow(r: TReviewResult) {
  return {
    headSha: r.headSha ?? "",
    riskTier: toRisk(r.riskTier),
    inlineCount: r.inline.length,
    summarizedCount: r.summarized.length,
    droppedCount: r.droppedCount,
    llmCalls: r.stats.llmCalls,
    durationMs: r.stats.durationMs,
    skippedReason: r.stats.skippedReason ?? null,
    findings: [
      ...r.inline.map((f) => findingRow(f, "INLINE")),
      ...r.summarized.map((f) => findingRow(f, "SUMMARY")),
    ],
  };
}

/**
 * How a category's accepted/dismissed counters move when a finding's outcome changes.
 * Re-sending the same outcome is a no-op, and flipping one way undoes the other.
 */
export function statDelta(prev: Outcome, next: Outcome): { accepted: number; dismissed: number } {
  const count = (o: Outcome) => ({
    accepted: o === "ACCEPTED" ? 1 : 0,
    dismissed: o === "DISMISSED" ? 1 : 0,
  });
  const a = count(prev);
  const b = count(next);
  return { accepted: b.accepted - a.accepted, dismissed: b.dismissed - a.dismissed };
}

async function upsertRepo(prisma: PrismaClient, owner: string, name: string) {
  return prisma.repo.upsert({ where: { owner_name: { owner, name } }, update: {}, create: { owner, name } });
}

export async function saveReviewStarted(
  prisma: PrismaClient,
  e: z.infer<typeof ReviewStarted>,
  repo: { owner: string; name: string },
) {
  const { id: repoId } = await upsertRepo(prisma, repo.owner, repo.name);
  await prisma.pullRequest.upsert({
    where: { repoId_number: { repoId, number: e.prNumber } },
    update: { reviewing: true },
    // Placeholder until the review arrives with the real title, author and risk.
    create: {
      repoId,
      number: e.prNumber,
      title: `PR #${e.prNumber}`,
      author: "",
      riskTier: "LOW",
      reviewing: true,
    },
  });
}

export async function saveReview(
  prisma: PrismaClient,
  r: TReviewResult,
  repo: { owner: string; name: string },
) {
  if (r.prNumber === undefined) throw new Error("PR review without prNumber");
  const { id: repoId } = await upsertRepo(prisma, repo.owner, repo.name);
  const pr = {
    title: r.prTitle ?? `PR #${r.prNumber}`,
    author: r.author ?? "",
    requestedReviewers: r.requestedReviewers,
    riskTier: toRisk(r.riskTier),
    reviewing: false,
  };
  const { findings, ...review } = reviewRow(r);
  await prisma.pullRequest.upsert({
    where: { repoId_number: { repoId, number: r.prNumber } },
    update: { ...pr, reviews: { create: { ...review, findings: { create: findings } } } },
    create: {
      repoId,
      number: r.prNumber,
      ...pr,
      reviews: { create: { ...review, findings: { create: findings } } },
    },
  });
}

/** Applies each outcome to the newest matching finding on that PR and keeps category stats in step. */
export async function saveFeedback(prisma: PrismaClient, events: z.infer<typeof FeedbackEvent>[]) {
  let applied = 0;
  for (const e of events) {
    const repo = splitRepo(e.repo);
    if (!repo) continue;
    const finding = await prisma.finding.findFirst({
      where: { fingerprint: e.fingerprint, review: { pr: { number: e.prNumber, repo } } },
      orderBy: { review: { createdAt: "desc" } },
      include: { review: { include: { pr: true } } },
    });
    if (!finding) continue;
    const next: Outcome = e.outcome === "accepted" ? "ACCEPTED" : "DISMISSED";
    const delta = statDelta(finding.outcome, next);
    const repoId = finding.review.pr.repoId;
    await prisma.$transaction([
      prisma.finding.update({ where: { id: finding.id }, data: { outcome: next, outcomeSource: e.source } }),
      prisma.categoryStat.upsert({
        where: { repoId_category: { repoId, category: finding.category } },
        update: { accepted: { increment: delta.accepted }, dismissed: { increment: delta.dismissed } },
        create: {
          repoId,
          category: finding.category,
          accepted: Math.max(0, delta.accepted),
          dismissed: Math.max(0, delta.dismissed),
        },
      }),
    ]);
    applied++;
  }
  return applied;
}
