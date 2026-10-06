import { db } from "@/lib/db";
import { GitHubError, listRepos } from "@/lib/github";
import { jsonError, requirePasscode } from "@/lib/http";

export async function GET(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const token = process.env.SIFT_GITHUB_TOKEN;
  if (!token) return jsonError(503, "not_configured", "GitHub access isn't configured (SIFT_GITHUB_TOKEN).");
  try {
    const [repos, enabled] = await Promise.all([
      listRepos(token),
      db().repo.findMany({ where: { enabled: true }, select: { owner: true, name: true } }),
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
      return jsonError(502, "github_error", "GitHub didn't accept the request. Check SIFT_GITHUB_TOKEN.");
    console.error("github/repos failed:", err instanceof Error ? err.message : String(err));
    return jsonError(503, "db_unavailable", "Couldn't load repositories. Try again in a moment.");
  }
}
