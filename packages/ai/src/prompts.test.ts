import { readFileSync } from "node:fs";
import { SEVERITY_DEFINITIONS, type TSeverity } from "@sift/shared";
import { describe, expect, it } from "vitest";

describe("review prompt", () => {
  const prompt = readFileSync(new URL("./prompts/review.md", import.meta.url), "utf8");

  it("states every severity definition word for word, so prompt and UI can't drift", () => {
    for (const [severity, text] of Object.entries(SEVERITY_DEFINITIONS) as [TSeverity, string][]) {
      expect(prompt).toContain(`- \`${severity}\`: ${text}`);
    }
  });
});
