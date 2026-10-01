import { ReviewStarted } from "@sift/shared";
import { db } from "@/lib/db";
import { readBody, jsonError, requireIngestAuth } from "@/lib/http";
import { saveReviewStarted, splitRepo } from "@/lib/ingest";

export async function POST(req: Request) {
  const denied = requireIngestAuth(req);
  if (denied) return denied;
  const body = await readBody(req, ReviewStarted);
  if (!body.ok) return body.res;
  const repo = splitRepo(body.data.repo);
  if (!repo) return jsonError(400, "invalid", "repo must be owner/name.", { repo: ["expected owner/name"] });
  await saveReviewStarted(db(), body.data, repo);
  return new Response(null, { status: 204 });
}
