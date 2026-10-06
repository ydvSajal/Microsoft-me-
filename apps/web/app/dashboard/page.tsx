import type { Metadata } from "next";
import Link from "next/link";
import { DbUnavailable, EmptyState, Page, PageHeader, Panel } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { listRepos, tryQuery } from "@/lib/queries";
import { ago } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const repos = await tryQuery(listRepos);
  return (
    <>
      <SiteNav current="/dashboard" />
      <Page className="pb-16">
        <PageHeader title="Repositories" meta="Every repo the Sift Action has reported a review for." />
        {!repos.ok ? (
          <DbUnavailable />
        ) : repos.data.length === 0 ? (
          <EmptyState title="No reviews yet">
            Add the Sift workflow to a repository and open a pull request. Its review shows up here once the
            Action posts it.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {repos.data.map((repo) => {
              const high = repo.prs.filter((p) => p.riskTier === "HIGH").length;
              const last = repo.prs.map((p) => p.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0];
              return (
                <li key={repo.id}>
                  <Link href={`/repos/${repo.owner}/${repo.name}`} className="group block">
                    <Panel className="p-5 transition-colors group-hover:border-accent">
                      <p className="font-mono text-sm text-muted">{repo.owner}/</p>
                      <p className="text-lg font-medium text-text">{repo.name}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span>
                          {repo._count.prs} PR{repo._count.prs === 1 ? "" : "s"}
                        </span>
                        {high > 0 && <span className="text-risk-high">{high} high risk</span>}
                        {last && <span className="ml-auto font-mono text-xs text-faint">{ago(last)}</span>}
                      </div>
                    </Panel>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </>
  );
}
