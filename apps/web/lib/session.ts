// Cookie sessions (T-45). The cookie holds a random token; the DB holds only its sha256.
import { cookies } from "next/headers";
import { cache } from "react";
import { newToken, sha256, unseal } from "./auth";
import { SESSION_COOKIE, SESSION_DAYS } from "./config";
import { db } from "./db";

const DAY_MS = 86_400_000;

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db().session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user, or null. Never throws: a DB outage reads as "signed out". Cached per request. */
export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const s = await db().session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    return s && s.expiresAt > new Date() ? s.user : null;
  } catch (err) {
    console.error("session lookup failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The user's GitHub token, unsealed; null when not linked or SIFT_AUTH_SECRET is missing or changed. */
export function githubTokenOf(user: { githubToken: string | null }): string | null {
  const secret = process.env.SIFT_AUTH_SECRET;
  return user.githubToken && secret ? unseal(user.githubToken, secret) : null;
}

/** "Signed in as …" label. */
export const displayName = (u: { githubLogin: string | null; email: string | null }) =>
  u.githubLogin ?? u.email ?? "account";
