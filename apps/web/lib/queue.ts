// Turns "these repos" into ReviewJob rows (T-38). A worker that runs them is T-33.
import { z } from "zod";
import { QUEUE_MAX_REPOS } from "./config";
import type { PrismaClient } from "./generated/prisma/client";
import type { GitHubPr, GitHubRepo } from "./github";
import { splitRepo } from "./ingest";

const RepoName = z.string().refine((s) => splitRepo(s) !== null, "expected owner/name");

/** Either named repos, or everything the token can read (capped at QUEUE_MAX_REPOS). */
export const QueueInput = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ repos: z.array(RepoName).min(1).max(QUEUE_MAX_REPOS) }),
]);
export type QueueInputT = z.infer<typeof QueueInput>;

export type QueueGitHub = {
  listRepos: () => Promise<GitHubRepo[]>;
  listOpenPrs: (owner: string, name: string) => Promise<GitHubPr[]>;
};

export type QueueResult = {
  queued: number; // new jobs created
  skipped: number; // already queued at the same commit
  drafts: number; // draft PRs are never reviewed
  failed: { repo: string; message: string }[]; // repos GitHub would not list; the rest still queue
  truncated: boolean; // `all` hit QUEUE_MAX_REPOS
};

/**
 * Enable each repo and queue one job per open, non-draft PR.
 * ponytail: repos are processed one after another, which is fine at QUEUE_MAX_REPOS (100).
 * Add bounded parallelism if the page ever needs more than that in one request.
 */
export async function queueRepos(
  db: Pick<PrismaClient, "repo" | "reviewJob" | "userRepo">,
  gh: QueueGitHub,
  input: QueueInputT,
  /** When signed in, picked repos also go on this user's watch list (T-46). */
  userId?: string,
): Promise<QueueResult> {
  let names: string[];
  let truncated = false;
  if ("all" in input) {
    const repos = await gh.listRepos();
    truncated = repos.length > QUEUE_MAX_REPOS;
    names = repos.slice(0, QUEUE_MAX_REPOS).map((r) => `${r.owner}/${r.name}`);
  } else names = [...new Set(input.repos)];

  const out: QueueResult = { queued: 0, skipped: 0, drafts: 0, failed: [], truncated };
  for (const full of names) {
    const parts = splitRepo(full);
    if (!parts) continue; // already validated by QueueInput; this keeps the type narrow
    let prs: GitHubPr[];
    try {
      prs = await gh.listOpenPrs(parts.owner, parts.name);
    } catch (err) {
      out.failed.push({ repo: full, message: err instanceof Error ? err.message : "GitHub request failed" });
      continue;
    }
    const open = prs.filter((p) => !p.draft);
    out.drafts += prs.length - open.length;
    const repo = await db.repo.upsert({
      where: { owner_name: parts },
      create: { ...parts, enabled: true },
      update: { enabled: true },
      select: { id: true },
    });
    if (userId) await db.userRepo.createMany({ data: [{ userId, repoId: repo.id }], skipDuplicates: true });
    const made = await db.reviewJob.createMany({
      data: open.map((p) => ({ repoId: repo.id, prNumber: p.number, title: p.title, headSha: p.headSha })),
      skipDuplicates: true,
    });
    out.queued += made.count;
    out.skipped += open.length - made.count;
  }
  return out;
}
