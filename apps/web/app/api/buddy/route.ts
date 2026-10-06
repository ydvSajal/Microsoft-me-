import type { TBuddyState } from "@sift/shared";
import { loadBuddyState } from "@/lib/buddy";

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

/** Public and read-only: the mood over all repos (per-user scoping arrives with accounts, T-45). Never throws. */
export async function GET() {
  try {
    return Response.json(await loadBuddyState(null));
  } catch (err) {
    console.error("buddy failed:", err instanceof Error ? err.message : String(err));
    return Response.json(OFFLINE);
  }
}
