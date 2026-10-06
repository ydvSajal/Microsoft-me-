import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNext, seal } from "@/lib/auth";
import { MAX_ACCOUNTS, OAUTH_STATE_COOKIE } from "@/lib/config";
import { db } from "@/lib/db";
import { exchangeCode, fetchGitHubUser, resolveGitHubSignIn } from "@/lib/github-oauth";
import { env, safeEqual } from "@/lib/http";
import { createSession, getUser } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, url));
  const jar = await cookies();
  const [state, next = "/dashboard"] = (jar.get(OAUTH_STATE_COOKIE)?.value ?? "").split("|");
  jar.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/github" });
  const code = url.searchParams.get("code");
  const got = url.searchParams.get("state");
  if (!state || !got || !code || !safeEqual(state, got)) return fail("state");

  const clientId = env("GITHUB_CLIENT_ID");
  const clientSecret = env("GITHUB_CLIENT_SECRET");
  const secret = env("SIFT_AUTH_SECRET");
  if (!clientId || !clientSecret || !secret) return fail("config");

  try {
    const token = await exchangeCode(code, { clientId, clientSecret });
    const gh = token ? await fetchGitHubUser(token) : null;
    if (!token || !gh) return fail("github");

    const prisma = db();
    const [current, linked, accounts] = await Promise.all([
      getUser(),
      prisma.user.findUnique({ where: { githubId: gh.id }, select: { id: true } }),
      prisma.user.count(),
    ]);
    const decision = resolveGitHubSignIn({
      currentUserId: current?.id ?? null,
      linkedUserId: linked?.id ?? null,
      accounts,
      maxAccounts: MAX_ACCOUNTS,
    });
    if (decision.kind === "error") return fail(decision.code);
    const data = { githubId: gh.id, githubLogin: gh.login, githubToken: seal(token, secret) };
    // A seeded demo user may already hold this login without a githubId; free the name first.
    await prisma.user.updateMany({
      where: {
        githubLogin: gh.login,
        githubId: null,
        ...(decision.kind === "link" ? { NOT: { id: decision.userId } } : {}),
      },
      data: { githubLogin: null },
    });
    const user =
      decision.kind === "link"
        ? await prisma.user.update({ where: { id: decision.userId }, data })
        : await prisma.user.create({ data });
    if (!current) await createSession(user.id);
  } catch (err) {
    console.error("github sign-in failed:", err instanceof Error ? err.message : String(err));
    return fail("github");
  }
  return NextResponse.redirect(new URL(safeNext(next), url));
}
