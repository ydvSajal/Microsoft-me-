import { ReviewResult } from "@sift/shared";
import { after } from "next/server";
import { db } from "@/lib/db";
import { jsonError, readBody, requireIngestAuth } from "@/lib/http";
import { saveReview, splitRepo } from "@/lib/ingest";
import { notifyWatchers } from "@/lib/notify";

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
  after(() => notifyWatchers(repo, r)); // Telegram pings run after the 204 is sent
  return new Response(null, { status: 204 });
}
