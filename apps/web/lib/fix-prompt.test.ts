import { readFileSync } from "node:fs";
import { ReviewResult, type TFinding } from "@sift/shared";
import { describe, expect, it } from "vitest";
import { promptForFile, promptForFinding } from "./fix-prompt";

const result = ReviewResult.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/shared/src/fixtures/review-result-file.json", import.meta.url),
      "utf8",
    ),
  ),
);
const all = [...result.inline, ...result.summarized];
const withFix = all.find((f) => f.suggestion) as TFinding;

describe("promptForFinding", () => {
  it("names file, line, severity, problem, code and fix", () => {
    const p = promptForFinding(withFix, "src/checkout.ts");
    for (const part of [
      "File: src/checkout.ts",
      `Line: ${withFix.line}`,
      `Severity: ${withFix.severity}`,
      withFix.title,
      withFix.quotedCode,
      withFix.suggestion as string,
      "ask before editing",
    ])
      expect(p).toContain(part);
  });

  it("works without a suggested fix", () => {
    const p = promptForFinding({ ...withFix, suggestion: undefined }, "a.ts");
    expect(p).not.toContain("Suggested fix");
    expect(p).toContain("ask before editing");
  });
});

describe("promptForFile", () => {
  it("numbers every finding, with or without a fix", () => {
    const p = promptForFile("src/checkout.ts", [withFix, { ...withFix, suggestion: undefined, line: 99 }]);
    expect(p).toContain("2 issues in src/checkout.ts");
    expect(p).toContain("### Issue 1 of 2");
    expect(p).toContain("### Issue 2 of 2");
    expect(p).toContain("Line: 99");
  });

  it("says so when there is nothing to fix", () => {
    expect(promptForFile("a.ts", [])).toContain("no issues");
  });
});
