import { FeedbackEvent } from "@sift/shared";
import { z } from "zod";
import { db } from "@/lib/db";
import { readBody, requireIngestAuth } from "@/lib/http";
import { saveFeedback } from "@/lib/ingest";

export async function POST(req: Request) {
  const denied = requireIngestAuth(req);
  if (denied) return denied;
  const body = await readBody(req, z.array(FeedbackEvent));
  if (!body.ok) return body.res;
  await saveFeedback(db(), body.data);
  return new Response(null, { status: 204 });
}
