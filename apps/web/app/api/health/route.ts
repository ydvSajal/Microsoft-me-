import { HEALTH_DB_TIMEOUT_MS } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness for deploy-smoke: never returns secrets, never throws. */
export async function GET() {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), HEALTH_DB_TIMEOUT_MS));
  // db() itself throws when DATABASE_URL is missing; run it inside the promise so that's db:false too.
  const ping = Promise.resolve()
    .then(() => db().$queryRaw`SELECT 1`)
    .then(() => true)
    .catch(() => false);
  const dbOk = await Promise.race([ping, timeout]).catch(() => false);
  return Response.json({ ok: true, db: dbOk, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" });
}
