// GitHub OAuth App sign-in (T-45). `fetch` is injected so tests never hit GitHub.
import { GITHUB_API } from "./config";

type Fetch = typeof fetch;

/** Swap the callback code for an access token; null when GitHub refuses. */
export async function exchangeCode(
  code: string,
  app: { clientId: string; clientSecret: string },
  f: Fetch = fetch,
): Promise<string | null> {
  const res = await f("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export async function fetchGitHubUser(
  token: string,
  f: Fetch = fetch,
): Promise<{ id: number; login: string } | null> {
  const res = await f(`${GITHUB_API}/user`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: number; login?: string };
  return typeof u.id === "number" && typeof u.login === "string" ? { id: u.id, login: u.login } : null;
}

/**
 * Who the GitHub sign-in belongs to:
 * signed in already → link to that account (unless another account owns this GitHub user);
 * else the account already linked to this GitHub user; else a new account (if under the cap).
 */
export function resolveGitHubSignIn(input: {
  currentUserId: string | null;
  linkedUserId: string | null;
  accounts: number;
  maxAccounts: number;
}): { kind: "link"; userId: string } | { kind: "create" } | { kind: "error"; code: "taken" | "closed" } {
  const { currentUserId, linkedUserId } = input;
  if (currentUserId) {
    return linkedUserId && linkedUserId !== currentUserId
      ? { kind: "error", code: "taken" }
      : { kind: "link", userId: currentUserId };
  }
  if (linkedUserId) return { kind: "link", userId: linkedUserId };
  return input.accounts >= input.maxAccounts ? { kind: "error", code: "closed" } : { kind: "create" };
}
