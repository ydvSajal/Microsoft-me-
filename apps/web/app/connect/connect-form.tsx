"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, Skeleton } from "@/components/ui";
import { allState, filterRepos, type RepoRow, toggleAll } from "@/lib/connect";
import { ago } from "@/lib/view";

type ApiError = { error: { code: string; message: string } };
type Job = { id: string; repo: string; prNumber: number; title: string; status: string; createdAt: string };
type QueueResult = {
  queued: number;
  skipped: number;
  drafts: number;
  failed: { repo: string; message: string }[];
  truncated: boolean;
};

const input =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent";
const primary =
  "inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60";

const STATUS_STYLE: Record<string, string> = {
  QUEUED: "bg-accent-soft text-accent",
  RUNNING: "bg-risk-medium-soft text-risk-medium",
  DONE: "bg-risk-low-soft text-risk-low",
  FAILED: "bg-risk-high-soft text-risk-high",
};

/** The session cookie authenticates; /connect is behind login. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : {},
  });
  const body = (await res.json()) as T | ApiError;
  if (typeof body === "object" && body !== null && "error" in body) {
    throw new Error(
      res.status === 401 ? "Your session ended. Log in again." : (body as ApiError).error.message,
    );
  }
  return body as T;
}

export function ConnectForm({ maxRepos, githubLinked }: { maxRepos: number; githubLinked: boolean }) {
  const [repos, setRepos] = useState<RepoRow[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"load" | "queue" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueueResult | null>(null);
  const allRef = useRef<HTMLInputElement>(null);

  const visible = repos ? filterRepos(repos, query) : [];
  const state = allState(visible, picked);
  const tooMany = picked.size > maxRepos;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = state === "some";
  }, [state]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on open
  useEffect(() => {
    void load();
  }, []);

  async function refresh() {
    const [r, q] = await Promise.all([
      call<{ repos: RepoRow[] }>("/api/github/repos"),
      call<{ jobs: Job[] }>("/api/queue"),
    ]);
    setRepos(r.repos);
    setJobs(q.jobs);
  }

  async function load() {
    setBusy("load");
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Sift. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function queue() {
    setBusy("queue");
    setError("");
    setResult(null);
    try {
      const out = await call<QueueResult>("/api/queue", {
        method: "POST",
        body: JSON.stringify({ repos: [...picked] }),
      });
      setResult(out);
      setPicked(new Set());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Sift. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <p className="min-w-40 flex-1 text-sm text-muted">
            {githubLinked
              ? "Your GitHub repositories. Picked ones go on your watch list."
              : "Showing the demo token's repositories. Link GitHub to pick from your own."}
          </p>
          {!githubLinked && (
            <a href="/api/auth/github?next=/connect" className={primary}>
              Link GitHub
            </a>
          )}
          <button type="button" onClick={() => void load()} disabled={busy !== null} className={primary}>
            {busy === "load" ? "Loading…" : "Reload"}
          </button>
        </div>

        {error && (
          <p role="alert" className="border-b border-line px-4 py-3 text-sm font-medium text-risk-high">
            {error}
          </p>
        )}

        {busy === "load" && !repos ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !repos ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Couldn't list repositories yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
                <input
                  ref={allRef}
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={state === "all"}
                  disabled={visible.length === 0}
                  onChange={(e) => setPicked(toggleAll(visible, picked, e.target.checked))}
                />
                Select all
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter repositories"
                aria-label="Filter repositories"
                className={`${input} min-w-40 flex-1`}
              />
              <span className="font-mono text-xs text-faint">
                {visible.length} of {repos.length}
              </span>
            </div>
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {repos.length === 0
                  ? "The token can't read any repositories. Give it access to the ones you want."
                  : `No repository matches “${query}”.`}
              </p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
                {visible.map((r) => (
                  <li key={r.fullName}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-[var(--accent)]"
                        checked={picked.has(r.fullName)}
                        onChange={(e) => setPicked(toggleAll([r], picked, e.target.checked))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium text-text">{r.fullName}</span>
                        <span className="text-xs text-muted">
                          {r.private ? "Private" : "Public"}
                          {r.language ? ` · ${r.language}` : ""}
                        </span>
                      </span>
                      {r.enabled && (
                        <span className="rounded-control bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                          Watching
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <div className="grid content-start gap-6">
        <Panel className="grid gap-4 p-4">
          <div className="flex gap-8">
            <div>
              <p className="font-mono text-3xl font-semibold tabular-nums text-text">{picked.size}</p>
              <p className="text-xs text-muted">repositories selected</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void queue()}
            disabled={picked.size === 0 || tooMany || busy !== null}
            className={primary}
          >
            {busy === "queue"
              ? "Queuing…"
              : picked.size === 0
                ? "Queue selected repositories"
                : `Queue ${picked.size} ${picked.size === 1 ? "repository" : "repositories"}`}
          </button>
          {tooMany && (
            <p className="text-xs text-risk-high">Select at most {maxRepos} repositories at a time.</p>
          )}
          {result && (
            <div
              role="status"
              className="grid gap-1 rounded-control bg-risk-low-soft px-3 py-2 text-sm text-risk-low"
            >
              <p>
                {result.queued} queued · {result.skipped} already queued · {result.drafts} draft
                {result.drafts === 1 ? "" : "s"} skipped
              </p>
              {result.failed.map((f) => (
                <p key={f.repo} className="text-risk-high">
                  {f.repo}: {f.message}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-faint">
            A pull request already queued at the same commit is skipped, so queuing twice never creates
            duplicates. Jobs stay Queued until the review worker exists, and new pull requests are not picked
            up automatically yet.
          </p>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-text">Review queue</h2>
            <span className="font-mono text-xs text-faint">
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </span>
          </div>
          {jobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nothing queued yet. Choose repositories and press Queue.
            </p>
          ) : (
            <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm text-text">
                      <span className="mr-1 font-mono text-xs text-muted">#{j.prNumber}</span>
                      {j.title}
                    </p>
                    <p className="mt-0.5 break-words font-mono text-xs text-muted">
                      {j.repo} <span className="ml-2 text-faint">{ago(new Date(j.createdAt))}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[j.status] ?? "bg-surface-2 text-muted"}`}
                  >
                    {j.status.charAt(0) + j.status.slice(1).toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
