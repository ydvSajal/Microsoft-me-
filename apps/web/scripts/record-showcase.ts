// Dev-only: reviews each showcase source with the real model and stores the result as JSON.
// Never run in CI or tests. Needs the model key from the repo's .env.
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { reviewFile } from "../lib/review-file";
import { SHOWCASE_SOURCES } from "./showcase-sources";

config({ path: new URL("../../../.env", import.meta.url) });
// Record from the primary model only: a silent switch to the weaker fallback model gives fixes-less reviews.
delete process.env.SIFT_FALLBACK_PROVIDER;

const dir = new URL("../lib/showcase/", import.meta.url);
mkdirSync(dir, { recursive: true });

for (const s of SHOWCASE_SOURCES) {
  const result = await reviewFile({ filename: s.filename, content: s.content });
  writeFileSync(new URL(`${s.slug}.json`, dir), `${JSON.stringify({ ...s, result }, null, 2)}\n`);
  console.log(
    `${s.slug}: ${result.inline.length} ranked, ${result.summarized.length} folded, ${result.stats.durationMs} ms`,
  );
}
