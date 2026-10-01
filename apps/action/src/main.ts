// GitHub Action entry: read env, hand off to @sift/core. Keep logic out of this file.
import { readFileSync } from "node:fs";
import { createGitHub, PrEvent, parseFeatures, runPrReview, skipReason } from "@sift/core";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

try {
  const event = PrEvent.parse(JSON.parse(readFileSync(required("GITHUB_EVENT_PATH"), "utf8")));
  const skip = skipReason(process.env.GITHUB_EVENT_NAME, event);
  if (skip) {
    console.log(`Sift: skipping (${skip}).`);
  } else {
    const { owner, name } = { owner: event.repository.owner.login, name: event.repository.name };
    const gh = createGitHub(required("GITHUB_TOKEN"), owner, name);
    const workspace = process.env.SIFT_WORKSPACE ?? process.cwd();
    const r = await runPrReview(
      { event, workspace },
      { gh, features: parseFeatures(process.env.SIFT_FEATURES) },
    );
    console.log(
      `Sift: reviewed PR #${r.prNumber}: risk ${r.riskTier}, ${r.inline.length} inline, ` +
        `${r.summarized.length} in summary, ${r.droppedCount} dropped, ${r.skippedFiles.length} files skipped, ` +
        `${r.stats.llmCalls} LLM calls, ${r.stats.durationMs} ms`,
    );
  }
} catch (err) {
  console.log(`::error::Sift failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
