import { ReviewResult } from "@sift/shared";
import { db } from "@/lib/db";
import { jsonError, readBody, requireIngestAuth } from "@/lib/http";
import { saveReview, splitRepo } from "@/lib/ingest";

export async function POST(req: Request) {
  const denied = requireIngestAuth(req);
  if (denied) return denied;
  const body = await readBody(req, ReviewResult);
  if (!body.ok) return body.res;
  const r = body.data;
  const repo = r.repo ? splitRepo(r.repo) : null;
  if (r.mode !== "pr" || !repo || r.prNumber === undefined) {
    return jsonError(400, "invalid", "Only PR reviews with repo and prNumber are ingested.");
  }
  await saveReview(db(), r, repo);
  return new Response(null, { status: 204 });
}
