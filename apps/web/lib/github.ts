// Minimal GitHub REST reads for the Connect page (T-38). `fetch` is injected so tests never hit GitHub.
import { GITHUB_API, GITHUB_MAX_PAGES, GITHUB_PER_PAGE } from "./config";

export type GitHubRepo = { owner: string; name: string; private: boolean; language: string | null };
export type GitHubPr = { number: number; title: string; headSha: string; draft: boolean };

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;
type RawRepo = { name: string; owner: { login: string }; private: boolean; language: string | null };
type RawPr = { number: number; title: string; draft?: boolean; head: { sha: string } };

/** GET one page; the token is only ever in the Authorization header, never in a message or a log. */
async function page<T>(token: string, path: string, n: number, f: Fetch): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await f(`${GITHUB_API}${path}${sep}per_page=${GITHUB_PER_PAGE}&page=${n}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} for ${path.split("?")[0]}`);
  return (await res.json()) as T[];
}

async function all<T>(token: string, path: string, f: Fetch): Promise<T[]> {
  const out: T[] = [];
  for (let n = 1; n <= GITHUB_MAX_PAGES; n++) {
    const items = await page<T>(token, path, n, f);
    out.push(...items);
    if (items.length < GITHUB_PER_PAGE) break;
  }
  return out;
}

/** Repos the token can read, most recently pushed first. Archived repos can't take new reviews, so they're left out. */
export async function listRepos(token: string, f: Fetch = fetch): Promise<GitHubRepo[]> {
  const raw = await all<RawRepo & { archived?: boolean }>(token, "/user/repos?sort=pushed", f);
  return raw
    .filter((r) => !r.archived)
    .map((r) => ({ owner: r.owner.login, name: r.name, private: r.private, language: r.language }));
}

export async function listOpenPrs(
  token: string,
  owner: string,
  name: string,
  f: Fetch = fetch,
): Promise<GitHubPr[]> {
  const raw = await all<RawPr>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=open`,
    f,
  );
  return raw.map((p) => ({ number: p.number, title: p.title, headSha: p.head.sha, draft: p.draft === true }));
}
