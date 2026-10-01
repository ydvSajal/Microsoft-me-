import { ProviderConfigError } from "@sift/ai";
import { jsonError, readBody, requireToken } from "@/lib/http";
import { ReviewFileInput, reviewFile } from "@/lib/review-file";

// One model call over up to 400 lines can take a while on free tiers.
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = requireToken(req.headers.get("x-sift-passcode"), process.env.SIFT_DEMO_PASSCODE, "");
  if (denied) return denied;
  const body = await readBody(req, ReviewFileInput);
  if (!body.ok) return body.res;
  try {
    return Response.json(await reviewFile(body.data));
  } catch (err) {
    if (err instanceof ProviderConfigError)
      return jsonError(503, "not_configured", "The AI provider isn't configured.");
    console.error("review-file failed:", err instanceof Error ? err.message : String(err));
    return jsonError(502, "review_failed", "The model call failed. Try again in a moment.");
  }
}
