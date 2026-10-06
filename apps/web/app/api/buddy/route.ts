import type { TBuddyState } from "@sift/shared";
import { loadBuddyState } from "@/lib/buddy";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

const OFFLINE: TBuddyState = {
  mood: "sleepy",
  text: "Not connected",
  pending: 0,
  critical: 0,
  high: 0,
  medium: 0,
  buzz: false,
  rev: 0,
};

/** Public and read-only. Signed in with a watch list: the mood of your repos; otherwise all repos. Never throws. */
export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    const watching = user ? await db().userRepo.count({ where: { userId: user.id } }) : 0;
    return Response.json(await loadBuddyState(watching > 0 && user ? user.id : null));
  } catch (err) {
    console.error("buddy failed:", err instanceof Error ? err.message : String(err));
    return Response.json(OFFLINE);
  }
}
