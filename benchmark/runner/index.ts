// pnpm bench: Sift vs the naive baseline on the labelled demo PRs. Writes benchmark/results.md.
// Needs GITHUB_TOKEN (read access to the demo repo) and the AI layer env (.env.example).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Octokit } from "@octokit/rest";
import { createGitHub, gitPatchId, PrEvent } from "@sift/core";
import { Labels } from "./labels";
import { renderResults } from "./report";
import { naiveReviewer, siftReviewer } from "./reviewers";
import { benchmark } from "./run";

/** PRD §6: every reviewer runs 3× per PR; medians are reported. */
const RUNS = 3;
const root = new URL("..", import.meta.url);

try {
  process.loadEnvFile(new URL("../.env", root));
} catch {}

const labelsPath = new URL("labels.json", root);
if (!existsSync(labelsPath)) {
  console.error(
    "benchmark/labels.json is missing. Commit it (T-17) before any run: the labels must come first.",
  );
  process.exit(2);
}
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set: the runner reads the demo repo's PRs (read-only).");
  process.exit(2);
}

const labels = Labels.parse(JSON.parse(readFileSync(labelsPath, "utf8")));
const [owner, name] = labels.repo.split("/") as [string, string];
const octokit = new Octokit({ auth: token, userAgent: "sift-bench" });
const gh = createGitHub(token, owner, name);

// One full clone; each PR is checked out in turn. The token goes in a header, never the URL.
const clone = mkdtempSync(join(tmpdir(), "sift-bench-"));
const auth = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
const git = (...args: string[]) =>
  execFileSync("git", ["-c", `http.https://github.com/.extraheader=${auth}`, ...args], {
    cwd: clone,
    stdio: "pipe",
  });
git("clone", "--quiet", `https://github.com/${labels.repo}.git`, ".");

async function prepare(pr: number) {
  const { data } = await octokit.rest.pulls.get({ owner, repo: name, pull_number: pr });
  git("fetch", "--quiet", "origin", `pull/${pr}/head`, data.base.ref);
  git("checkout", "--quiet", "--force", data.head.sha);
  const event = PrEvent.parse({ pull_request: data, repository: { name, owner: { login: owner } } });
  return { event, workspace: clone, files: await gh.listFiles(pr) };
}

const scores = await benchmark({
  labels,
  reviewers: [siftReviewer({}, gitPatchId), naiveReviewer({})],
  runs: RUNS,
  prepare,
  log: (line) => console.log(line),
});

const md = renderResults({
  repo: labels.repo,
  prs: labels.prs.length,
  runs: RUNS,
  model: process.env.SIFT_MODEL ?? "default",
  at: new Date(),
  scores,
});
writeFileSync(new URL("results.md", root), md);
writeFileSync(new URL("results.json", root), `${JSON.stringify(scores, null, 2)}\n`);
console.log(md);
