import { QUEUE_LIST_LIMIT } from "@/lib/config";
import { db } from "@/lib/db";
import { GitHubError, listOpenPrs, listRepos } from "@/lib/github";
import { jsonError, readBody } from "@/lib/http";
import { QueueInput, queueRepos } from "@/lib/queue";
import { connectAccess } from "@/lib/session";

// Listing open PRs for up to QUEUE_MAX_REPOS repos is a few seconds of GitHub calls.
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await connectAccess(req);
  if ("denied" in access) return access.denied;
  const { user, token } = access;
  const body = await readBody(req, QueueInput);
  if (!body.ok) return body.res;
  if (!token)
    return jsonError(
      503,
      "not_configured",
      "Press Link GitHub to use your own repositories (or set SIFT_GITHUB_TOKEN on the server).",
    );
  try {
    const result = await queueRepos(
      db(),
      { listRepos: () => listRepos(token), listOpenPrs: (o, n) => listOpenPrs(token, o, n) },
      body.data,
      user?.id,
    );
    return Response.json(result);
  } catch (err) {
    if (err instanceof GitHubError)
      return jsonError(502, "github_error", "GitHub didn't accept the request. Try linking GitHub again.");
    console.error("queue failed:", err instanceof Error ? err.message : String(err));
    return jsonError(503, "db_unavailable", "Couldn't queue the repositories. Try again in a moment.");
  }
}

export async function GET(req: Request) {
  const access = await connectAccess(req);
  if ("denied" in access) return access.denied;
  try {
    const jobs = await db().reviewJob.findMany({
      orderBy: { createdAt: "desc" },
      take: QUEUE_LIST_LIMIT,
      include: { repo: { select: { owner: true, name: true } } },
    });
    return Response.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        repo: `${j.repo.owner}/${j.repo.name}`,
        prNumber: j.prNumber,
        title: j.title,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("queue list failed:", err instanceof Error ? err.message : String(err));
    return jsonError(503, "db_unavailable", "Couldn't load the queue. Try again in a moment.");
  }
}
