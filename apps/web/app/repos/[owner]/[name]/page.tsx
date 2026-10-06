import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DbUnavailable, EmptyState, Page, PageHeader, Panel, RiskBadge } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { getRepo, tryQuery } from "@/lib/queries";
import { ago, percent, precision, riskOf } from "@/lib/view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/repos/[owner]/[name]">): Promise<Metadata> {
  const { owner, name } = await params;
  return { title: `${owner}/${name}` };
}

export default async function RepoPage({ params }: PageProps<"/repos/[owner]/[name]">) {
  const { owner, name } = await params;
  const repo = await tryQuery(() => getRepo(owner, name));
  if (repo.ok && !repo.data) notFound();

  return (
    <>
      <SiteNav current="/dashboard" />
      <Page className="pb-16">
        <PageHeader
          title={
            <>
              <span className="text-muted">{owner}/</span>
              {name}
            </>
          }
          meta={
            <Link href="/dashboard" className="hover:text-text">
              All repositories
            </Link>
          }
        />
        {!repo.ok || !repo.data ? (
          <DbUnavailable />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Panel className="overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 text-sm font-medium text-text">Pull requests</h2>
              {repo.data.prs.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted">No pull requests reviewed yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {repo.data.prs.map((pr) => {
                    const latest = pr.reviews[0];
                    return (
                      <li key={pr.id}>
                        <Link
                          href={`/prs/${pr.id}`}
                          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2"
                        >
                          <p className="min-w-0 truncate text-sm text-text">
                            <span className="font-mono text-muted">#{pr.number}</span> {pr.title}
                          </p>
                          <RiskBadge tier={riskOf(pr.riskTier)} label={false} />
                          <p className="font-mono text-xs text-faint">
                            {pr.author || "unknown author"}
                            <span className="ml-3">
                              {pr.reviewing
                                ? "reviewing now"
                                : latest
                                  ? `${latest.inlineCount} inline, ${latest.summarizedCount} in summary`
                                  : "no review yet"}
                            </span>
                          </p>
                          <p className="font-mono text-xs text-faint">{ago(pr.updatedAt)}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <PrecisionPanel stats={repo.data.stats} />
          </div>
        )}
      </Page>
    </>
  );
}

function PrecisionPanel({
  stats,
}: {
  stats: { category: string; accepted: number; dismissed: number; muted: boolean }[];
}) {
  return (
    <Panel className="self-start p-4">
      <h2 className="text-sm font-medium text-text">Precision by category</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Accepted findings out of those with an outcome: fixed, upvoted or dismissed.
      </p>
      {stats.length === 0 ? (
        <EmptyHint />
      ) : (
        <dl className="mt-4 grid gap-3">
          {stats.map((s) => {
            const p = precision(s.accepted, s.dismissed);
            return (
              <div key={s.category}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <dt className="text-text">
                    {s.category}
                    {s.muted && <span className="ml-2 font-mono text-xs text-faint">muted</span>}
                  </dt>
                  <dd className="font-mono text-text">{p === null ? "n/a" : percent(p)}</dd>
                </div>
                {p !== null && (
                  <div
                    aria-hidden="true"
                    className="mt-1.5 h-1 rounded-full bg-accent"
                    style={{ width: percent(p) }}
                  />
                )}
                <p className="mt-1 font-mono text-xs text-faint">
                  {s.accepted + s.dismissed} sample{s.accepted + s.dismissed === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </dl>
      )}
    </Panel>
  );
}

function EmptyHint() {
  return (
    <EmptyState title="No outcomes yet">
      Precision appears once reviewers fix, upvote or dismiss Sift&apos;s comments.
    </EmptyState>
  );
}
