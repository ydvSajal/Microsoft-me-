// Gathers computeBuddyState's inputs from Postgres (TRD §6). Scoped to a user's watched repos when given one.
import { type BuddyPr, computeBuddyState, type TBuddyState, type TSeverity } from "@sift/shared";
import { BUDDY_PR_LIMIT, DEFAULT_WAIT_HOURS } from "./config";
import { db } from "./db";
import { lower } from "./view";

const HOUR_MS = 3_600_000;

export async function loadBuddyState(userId: string | null, now = new Date()): Promise<TBuddyState> {
  const prisma = db();
  const scope = userId ? { repo: { watchers: { some: { userId } } } } : {};
  const [user, reviewing, prs] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { snoozedUntil: true } }) : null,
    prisma.pullRequest.findFirst({ where: { ...scope, reviewing: true }, select: { number: true } }),
    prisma.pullRequest.findMany({
      where: scope,
      orderBy: { updatedAt: "desc" },
      take: BUDDY_PR_LIMIT,
      select: {
        number: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            findings: {
              where: { outcome: "PENDING", placement: { not: "DROPPED" } },
              orderBy: { confidence: "desc" },
              select: { severity: true, title: true },
            },
          },
        },
      },
    }),
  ]);
  const pending: BuddyPr[] = prs.flatMap((p) => {
    const review = p.reviews[0];
    if (!review) return [];
    const findings = review.findings.map((f) => ({ severity: lower<TSeverity>(f.severity), title: f.title }));
    // A clean PR isn't waiting on anyone, so it never makes the buddy impatient.
    const waitingHours = findings.length ? (now.getTime() - review.createdAt.getTime()) / HOUR_MS : 0;
    return [{ number: p.number, waitingHours, findings }];
  });
  return computeBuddyState({
    snoozed: !!user?.snoozedUntil && user.snoozedUntil > now,
    reviewing: reviewing?.number ?? null,
    prs: pending,
    waitHours: Number(process.env.WAIT_HOURS) || DEFAULT_WAIT_HOURS,
    rev: 0, // ponytail: the web buddy polls, so it has no use for rev; the firmware (T-27) will add it
  });
}
