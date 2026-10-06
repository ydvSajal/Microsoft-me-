import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DbUnavailable,
  EmptyState,
  FindingList,
  Page,
  PageHeader,
  Panel,
  RiskBadge,
  Stat,
} from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { getPr, tryQuery } from "@/lib/queries";
import { ago, duration, type FindingView, lower, riskOf } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pull request" };

export default async function PrPage({ params }: PageProps<"/prs/[id]">) {
  const { id } = await params;
  const pr = await tryQuery(() => getPr(id));
  if (pr.ok && !pr.data) notFound();
  if (!pr.ok || !pr.data) {
    return (
      <>
        <SiteNav current="/dashboard" />
        <Page className="py-8">
          <DbUnavailable />
        </Page>
      </>
    );
  }

  const { repo, reviews } = pr.data;
  const [latest, ...older] = reviews;
  const findings: FindingView[] = (latest?.findings ?? []).map((f) => ({
    severity: lower(f.severity),
    category: f.category,
    file: f.file,
    line: f.line,
    title: f.title,
    confidence: f.confidence,
    placement: lower<NonNullable<FindingView["placement"]>>(f.placement),
    outcome: lower<NonNullable<FindingView["outcome"]>>(f.outcome),
  }));

  return (
    <>
      <SiteNav current="/dashboard" />
      <Page className="pb-16">
        <PageHeader
          title={
            <>
              <span className="font-mono text-muted">#{pr.data.number}</span> {pr.data.title}
            </>
          }
          meta={
            <Link href={`/repos/${repo.owner}/${repo.name}`} className="hover:text-text">
              {repo.owner}/{repo.name}
            </Link>
          }
        >
          <RiskBadge tier={riskOf(pr.data.riskTier)} />
        </PageHeader>

        {!latest ? (
          <EmptyState title={pr.data.reviewing ? "Review in progress" : "No review yet"}>
            {pr.data.reviewing
              ? "The Action has started reviewing this pull request. Reload in a minute."
              : "This pull request hasn't been reviewed."}
          </EmptyState>
        ) : (
          <div className="grid gap-6">
            <Panel className="p-4">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-6">
                <Stat label="Inline" value={latest.inlineCount} />
                <Stat label="In summary" value={latest.summarizedCount} />
                <Stat label="Dropped" value={latest.droppedCount} />
                <Stat label="Model calls" value={latest.llmCalls} />
                <Stat label="Took" value={duration(latest.durationMs)} />
                <Stat label="Reviewed" value={ago(latest.createdAt)} />
              </dl>
              {latest.skippedReason && (
                <p className="mt-4 text-sm text-muted">
                  Skipped: <span className="font-mono">{latest.skippedReason}</span>
                </p>
              )}
            </Panel>
            <Panel className="overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 text-sm font-medium text-text">
                Findings on{" "}
                <span className="font-mono text-muted">{latest.headSha.slice(0, 7) || "unknown"}</span>
              </h2>
              <FindingList findings={findings} empty="Nothing to flag on this push." />
            </Panel>
            {older.length > 0 && (
              <Panel className="p-4">
                <h2 className="text-sm font-medium text-text">Earlier reviews</h2>
                <ul className="mt-3 grid gap-2 font-mono text-xs text-muted">
                  {older.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-4">
                      <span>{r.headSha.slice(0, 7)}</span>
                      <span>{lower(r.riskTier)}</span>
                      <span>{r.findings.length} findings</span>
                      <span className="text-faint">{ago(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </Page>
    </>
  );
}
