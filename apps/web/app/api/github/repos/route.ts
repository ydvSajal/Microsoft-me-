import { db } from "@/lib/db";
import { GitHubError, listRepos } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { connectAccess } from "@/lib/session";

export async function GET(req: Request) {
  const access = await connectAccess(req);
  if ("denied" in access) return access.denied;
  const { user, token } = access;
  if (!token)
    return jsonError(
      503,
      "not_configured",
      "Press Link GitHub to use your own repositories (or set SIFT_GITHUB_TOKEN on the server).",
    );
  try {
    // Signed in: "enabled" means repos this user watches; with the passcode, repos anyone enabled.
    const [repos, enabled] = await Promise.all([
      listRepos(token),
      db().repo.findMany({
        where: user ? { watchers: { some: { userId: user.id } } } : { enabled: true },
        select: { owner: true, name: true },
      }),
    ]);
    const on = new Set(enabled.map((r) => `${r.owner}/${r.name}`));
    return Response.json({
      repos: repos.map((r) => ({
        ...r,
        fullName: `${r.owner}/${r.name}`,
        enabled: on.has(`${r.owner}/${r.name}`),
      })),
    });
  } catch (err) {
    if (err instanceof GitHubError)
      return jsonError(502, "github_error", "GitHub didn't accept the request. Try linking GitHub again.");
    console.error("github/repos failed:", err instanceof Error ? err.message : String(err));
    return jsonError(503, "db_unavailable", "Couldn't load repositories. Try again in a moment.");
  }
}
