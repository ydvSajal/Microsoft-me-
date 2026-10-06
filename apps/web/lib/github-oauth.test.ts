import { describe, expect, it, vi } from "vitest";
import { exchangeCode, fetchGitHubUser, resolveGitHubSignIn } from "./github-oauth";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const app = { clientId: "id", clientSecret: "secret" };

describe("exchangeCode", () => {
  it("returns the access token", async () => {
    const f = vi.fn(async () => json({ access_token: "gho_x" }));
    expect(await exchangeCode("c", app, f)).toBe("gho_x");
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({
      code: "c",
      client_id: "id",
    });
  });

  it("is null on an error body or status", async () => {
    expect(await exchangeCode("c", app, async () => json({ error: "bad_verification_code" }))).toBeNull();
    expect(await exchangeCode("c", app, async () => json({}, 500))).toBeNull();
  });
});

describe("fetchGitHubUser", () => {
  it("reads id and login", async () => {
    expect(await fetchGitHubUser("t", async () => json({ id: 5, login: "octo" }))).toEqual({
      id: 5,
      login: "octo",
    });
    expect(await fetchGitHubUser("t", async () => json({}, 401))).toBeNull();
  });
});

describe("resolveGitHubSignIn", () => {
  const base = { currentUserId: null, linkedUserId: null, accounts: 3, maxAccounts: 20 };
  it.each([
    [{}, { kind: "create" }],
    [{ accounts: 20 }, { kind: "error", code: "closed" }],
    [
      { linkedUserId: "u1", accounts: 20 },
      { kind: "link", userId: "u1" },
    ],
    [{ currentUserId: "u2" }, { kind: "link", userId: "u2" }],
    [
      { currentUserId: "u2", linkedUserId: "u2" },
      { kind: "link", userId: "u2" },
    ],
    [
      { currentUserId: "u2", linkedUserId: "u1" },
      { kind: "error", code: "taken" },
    ],
  ])("%j → %j", (over, out) => {
    expect(resolveGitHubSignIn({ ...base, ...over })).toEqual(out);
  });
});
