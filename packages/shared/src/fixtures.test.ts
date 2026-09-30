import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Finding, ReviewResult } from "./schemas";

// GitHub's "list PR files" shape: only the fields the diff map reads.
const PrFile = z.object({
  filename: z.string(),
  status: z.enum(["added", "modified", "removed", "renamed", "copied", "changed", "unchanged"]),
  patch: z.string().optional(),
  previous_filename: z.string().optional(),
});

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("fixtures match their schemas", () => {
  it.each([
    ["patch-multi-hunk.json", z.array(PrFile)],
    ["findings-sample.json", z.array(Finding)],
    ["review-result-pr.json", ReviewResult],
    ["review-result-file.json", ReviewResult],
    ["review-result-stack.json", ReviewResult],
  ] as const)("%s", (name, schema) => {
    expect(() => schema.parse(load(name))).not.toThrow();
  });

  it("review-result-file is file mode without PR fields", () => {
    const r = ReviewResult.parse(load("review-result-file.json"));
    expect(r.mode).toBe("file");
    expect(r.prNumber).toBeUndefined();
  });
});
