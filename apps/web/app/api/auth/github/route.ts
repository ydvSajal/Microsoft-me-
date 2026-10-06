import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { newToken, safeNext } from "@/lib/auth";
import { GITHUB_OAUTH_SCOPE, OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_S } from "@/lib/config";

/** Start GitHub sign-in: remember a random state (CSRF) and where to land, then go to GitHub. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?error=config", url));
  const state = newToken();
  (await cookies()).set(OAUTH_STATE_COOKIE, `${state}|${safeNext(url.searchParams.get("next"))}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/github",
    maxAge: OAUTH_STATE_MAX_AGE_S,
  });
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", clientId);
  gh.searchParams.set("redirect_uri", new URL("/api/auth/github/callback", url).toString());
  gh.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
  gh.searchParams.set("state", state);
  return NextResponse.redirect(gh);
}
