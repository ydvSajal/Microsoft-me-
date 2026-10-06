import { describe, expect, it } from "vitest";
import { QUEUE_MAX_REPOS } from "./config";
import type { PrismaClient } from "./generated/prisma/client";
import type { GitHubPr } from "./github";
import { QueueInput, queueRepos } from "./queue";

const pr = (number: number, over: Partial<GitHubPr> = {}): GitHubPr => ({
  number,
  title: `PR ${number}`,
  headSha: `sha${number}`,
  draft: false,
  ...over,
});

/** In-memory stand-in for the two Prisma delegates queueRepos uses. */
function fakeDb() {
  const repos = new Map<string, { id: string; enabled: boolean }>();
  const jobs = new Map<string, { repoId: string; prNumber: number; headSha: string; title: string }>();
  const db = {
    repo: {
      upsert: async ({
        where,
        create,
      }: {
        where: { owner_name: { owner: string; name: string } };
        create: object;
      }) => {
        const key = `${where.owner_name.owner}/${where.owner_name.name}`;
        const row = repos.get(key) ?? { id: `id-${repos.size + 1}`, enabled: false, ...create };
        repos.set(key, { ...row, enabled: true });
        return { id: row.id };
      },
    },
    reviewJob: {
      createMany: async ({
        data,
      }: {
        data: { repoId: string; prNumber: number; headSha: string; title: string }[];
      }) => {
        let count = 0;
        for (const d of data) {
          const key = `${d.repoId}:${d.prNumber}:${d.headSha}`;
          if (!jobs.has(key)) {
            jobs.set(key, d);
            count++;
          }
        }
        return { count };
      },
    },
  } as unknown as Pick<PrismaClient, "repo" | "reviewJob">;
  return { db, repos, jobs };
}

const github = (prsByRepo: Record<string, GitHubPr[] | Error>) => ({
  listRepos: async () =>
    Object.keys(prsByRepo).map((full) => ({
      owner: full.split("/")[0] as string,
      name: full.split("/")[1] as string,
      private: true,
      language: null,
    })),
  listOpenPrs: async (owner: string, name: string) => {
    const v = prsByRepo[`${owner}/${name}`];
    if (!v) return [];
    if (v instanceof Error) throw v;
    return v;
  },
});

describe("QueueInput", () => {
  it("accepts named repos or all:true", () => {
    expect(QueueInput.safeParse({ repos: ["o/n"] }).success).toBe(true);
    expect(QueueInput.safeParse({ all: true }).success).toBe(true);
  });

  it.each([
    [{}],
    [{ repos: [] }],
    [{ repos: ["no-slash"] }],
    [{ repos: ["../etc"] }],
    [{ all: false }],
    [{ repos: Array.from({ length: QUEUE_MAX_REPOS + 1 }, (_, i) => `o/r${i}`) }],
  ])("rejects %j", (body) => expect(QueueInput.safeParse(body).success).toBe(false));
});

describe("queueRepos", () => {
  it("enables each repo and queues its open PRs, skipping drafts", async () => {
    const { db, repos, jobs } = fakeDb();
    const gh = github({ "o/a": [pr(1), pr(2, { draft: true })], "o/b": [pr(3)] });
    const out = await queueRepos(db, gh, { repos: ["o/a", "o/b"] });
    expect(out).toEqual({ queued: 2, skipped: 0, drafts: 1, failed: [], truncated: false });
    expect([...repos.values()].every((r) => r.enabled)).toBe(true);
    expect(jobs.size).toBe(2);
  });

  it("queuing the same repo twice creates nothing new", async () => {
    const { db, jobs } = fakeDb();
    const gh = github({ "o/a": [pr(1), pr(2)] });
    await queueRepos(db, gh, { repos: ["o/a"] });
    const again = await queueRepos(db, gh, { repos: ["o/a"] });
    expect(again).toMatchObject({ queued: 0, skipped: 2 });
    expect(jobs.size).toBe(2);
  });

  it("queues a PR again after a new push (new head sha)", async () => {
    const { db, jobs } = fakeDb();
    await queueRepos(db, github({ "o/a": [pr(1)] }), { repos: ["o/a"] });
    const out = await queueRepos(db, github({ "o/a": [pr(1, { headSha: "newsha" })] }), { repos: ["o/a"] });
    expect(out.queued).toBe(1);
    expect(jobs.size).toBe(2);
  });

  it("reports a repo GitHub can't list and still queues the others", async () => {
    const { db, repos } = fakeDb();
    const gh = github({ "o/a": new Error("GitHub answered 404"), "o/b": [pr(1)] });
    const out = await queueRepos(db, gh, { repos: ["o/a", "o/b"] });
    expect(out.queued).toBe(1);
    expect(out.failed).toEqual([{ repo: "o/a", message: "GitHub answered 404" }]);
    expect(repos.has("o/a")).toBe(false); // a repo that couldn't be read is not enabled
  });

  it("all:true queues every repo the token can read", async () => {
    const { db } = fakeDb();
    const gh = github({ "o/a": [pr(1)], "o/b": [pr(2)] });
    expect(await queueRepos(db, gh, { all: true })).toMatchObject({ queued: 2, truncated: false });
  });

  it("all:true is capped and says so", async () => {
    const { db } = fakeDb();
    const many = Object.fromEntries(
      Array.from({ length: QUEUE_MAX_REPOS + 5 }, (_, i) => [`o/r${i}`, [] as GitHubPr[]]),
    );
    const out = await queueRepos(db, github(many), { all: true });
    expect(out.truncated).toBe(true);
  });
});
