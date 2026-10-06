import { describe, expect, it } from "vitest";
import { GITHUB_PER_PAGE } from "./config";
import { GitHubError, listOpenPrs, listRepos } from "./github";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fetch that answers from a queue and records what it was asked. */
function fakeFetch(...answers: Response[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    return next;
  }) as unknown as typeof fetch;
  return { f, calls };
}

const rawRepo = (name: string, extra = {}) => ({
  name,
  owner: { login: "o" },
  private: true,
  language: "TypeScript",
  ...extra,
});

describe("listRepos", () => {
  it("maps repos, drops archived ones and sends the token as a Bearer header", async () => {
    const { f, calls } = fakeFetch(json([rawRepo("a"), rawRepo("b", { archived: true })]));
    expect(await listRepos("tok", f)).toEqual([
      { owner: "o", name: "a", private: true, language: "TypeScript" },
    ]);
    expect(calls[0]?.headers.authorization).toBe("Bearer tok");
    expect(calls[0]?.url).toContain("/user/repos?sort=pushed&per_page=100&page=1");
  });

  it("follows pages until one comes back short", async () => {
    const full = Array.from({ length: GITHUB_PER_PAGE }, (_, i) => rawRepo(`r${i}`));
    const { f, calls } = fakeFetch(json(full), json([rawRepo("last")]));
    expect(await listRepos("tok", f)).toHaveLength(GITHUB_PER_PAGE + 1);
    expect(calls.map((c) => /[?&]page=(\d+)/.exec(c.url)?.[1])).toEqual(["1", "2"]);
  });

  it("throws GitHubError without leaking the token when GitHub rejects it", async () => {
    const { f } = fakeFetch(json({ message: "Bad credentials" }, 401));
    const err = await listRepos("secret-token", f).catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err.status).toBe(401);
    expect(err.message).not.toContain("secret-token");
  });
});

describe("listOpenPrs", () => {
  it("returns number, title, head sha and the draft flag", async () => {
    const { f, calls } = fakeFetch(
      json([
        { number: 1, title: "one", head: { sha: "aaa" } },
        { number: 2, title: "two", draft: true, head: { sha: "bbb" } },
      ]),
    );
    expect(await listOpenPrs("tok", "o", "n", f)).toEqual([
      { number: 1, title: "one", headSha: "aaa", draft: false },
      { number: 2, title: "two", headSha: "bbb", draft: true },
    ]);
    expect(calls[0]?.url).toContain("/repos/o/n/pulls?state=open&per_page=100&page=1");
  });
});
