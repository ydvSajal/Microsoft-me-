// Selection logic for the Connect page, kept pure so it can be tested without a browser.
export type RepoRow = { fullName: string; private: boolean; language: string | null; enabled: boolean };
export type AllState = "none" | "some" | "all";

export function filterRepos(repos: RepoRow[], query: string): RepoRow[] {
  const q = query.trim().toLowerCase();
  return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
}

/** State of the "Select all" box for the repos currently shown. */
export function allState(visible: RepoRow[], picked: ReadonlySet<string>): AllState {
  const n = visible.filter((r) => picked.has(r.fullName)).length;
  return n === 0 ? "none" : n === visible.length ? "all" : "some";
}

/** Tick or untick every shown repo, leaving picks hidden by the filter alone. */
export function toggleAll(visible: RepoRow[], picked: ReadonlySet<string>, on: boolean): Set<string> {
  const next = new Set(picked);
  for (const r of visible) on ? next.add(r.fullName) : next.delete(r.fullName);
  return next;
}
