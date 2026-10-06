// Read-only queries behind the dashboard pages. Pages render a "not connected" state when these throw.
import { db } from "./db";

/** All repos, or only the ones `userId` watches. */
export async function listRepos(userId?: string) {
  return db().repo.findMany({
    where: userId ? { watchers: { some: { userId } } } : {},
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { prs: true } },
      prs: { select: { riskTier: true, updatedAt: true } },
    },
  });
}

export async function getRepo(owner: string, name: string) {
  return db().repo.findUnique({
    where: { owner_name: { owner, name } },
    include: {
      stats: { orderBy: { category: "asc" } },
      prs: {
        orderBy: { updatedAt: "desc" },
        include: {
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { inlineCount: true, summarizedCount: true, createdAt: true },
          },
        },
      },
    },
  });
}

export async function getPr(id: string) {
  return db().pullRequest.findUnique({
    where: { id },
    include: {
      repo: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { findings: { orderBy: [{ placement: "asc" }, { confidence: "desc" }] } },
      },
    },
  });
}

/** Runs a query; `null` result means the database isn't reachable (or isn't configured). */
export async function tryQuery<T>(run: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    console.error("dashboard query failed:", err instanceof Error ? err.message : String(err));
    return { ok: false };
  }
}
