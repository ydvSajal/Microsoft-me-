import { Category } from "@sift/shared";
import { db } from "@/lib/db";
import { requireIngestAuth } from "@/lib/http";

/** Per-repo settings the Action reads before a review: the muted categories (TRD §4.3). */
export async function GET(req: Request, ctx: RouteContext<"/api/repos/[owner]/[name]/config">) {
  const denied = requireIngestAuth(req);
  if (denied) return denied;
  const { owner, name } = await ctx.params;
  const stats = await db().categoryStat.findMany({
    where: { muted: true, repo: { owner, name } },
    select: { category: true },
  });
  const muted = stats.map((s) => s.category).filter((c) => Category.safeParse(c).success);
  return Response.json({ muted });
}
