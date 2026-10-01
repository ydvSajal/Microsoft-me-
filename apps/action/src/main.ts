// GitHub Action entry: read env, hand off to @sift/core. Keep logic out of this file.
import { readFileSync } from "node:fs";
import {
  createGitHub,
  createIngest,
  PrEvent,
  parseFeatures,
  reportFeedback,
  runPrReview,
  skipReason,
} from "@sift/core";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

try {
  const event = PrEvent.parse(JSON.parse(readFileSync(required("GITHUB_EVENT_PATH"), "utf8")));
  const eventName = process.env.GITHUB_EVENT_NAME;
  const features = parseFeatures(process.env.SIFT_FEATURES);
  const { owner, name } = { owner: event.repository.owner.login, name: event.repository.name };
  // The dashboard API is optional: without both settings, Sift still reviews and posts.
  const ingest =
    process.env.SIFT_API_URL && process.env.SIFT_INGEST_SECRET
      ? createIngest(process.env.SIFT_API_URL, process.env.SIFT_INGEST_SECRET)
      : undefined;

  if (eventName === "pull_request_review_comment") {
    // A reply like "/sift accept" arrived: record outcomes only, no review.
    if (ingest && features.has("feedback")) {
      const gh = createGitHub(required("GITHUB_TOKEN"), owner, name);
      const n = await reportFeedback(gh, ingest, `${owner}/${name}`, event.pull_request.number);
      console.log(`Sift: reported ${n} feedback outcome(s).`);
    } else console.log("Sift: comment event ignored (feedback flag or API not configured).");
  } else {
    const skip = skipReason(eventName, event);
    if (skip) {
      console.log(`Sift: skipping (${skip}).`);
    } else {
      const gh = createGitHub(required("GITHUB_TOKEN"), owner, name);
      const workspace = process.env.SIFT_WORKSPACE ?? process.cwd();
      const r = await runPrReview({ event, workspace }, { gh, features, ingest });
      console.log(
        `Sift: reviewed PR #${r.prNumber}: risk ${r.riskTier}, ${r.inline.length} inline, ` +
          `${r.summarized.length} in summary, ${r.droppedCount} dropped, ${r.skippedFiles.length} files skipped, ` +
          `${r.stats.llmCalls} LLM calls, ${r.stats.durationMs} ms`,
      );
    }
  }
} catch (err) {
  console.log(`::error::Sift failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
