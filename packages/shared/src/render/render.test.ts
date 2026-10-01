import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ReviewResult, type TFinding } from "../schemas";
import { clean, codeBlock, renderInline } from "./inline";
import { renderSummary } from "./summary";

const load = (name: string) =>
  ReviewResult.parse(JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")));
const pr = load("review-result-pr.json");
const [critical, security] = pr.inline as [TFinding, TFinding];

describe("renderInline", () => {
  it("matches the snapshot", () => {
    expect(renderInline(critical)).toMatchSnapshot();
  });

  it("ends with the hidden fingerprint marker", () => {
    expect(renderInline(security).endsWith("<!-- sift:fp=fd2e362cd615 -->")).toBe(true);
  });

  it("lists other locations and omits the fix block when there is no suggestion", () => {
    const body = renderInline({
      ...critical,
      suggestion: undefined,
      alsoIn: [{ file: "src/a.ts", line: 3 }],
    });
    expect(body).toContain("Same issue also in `src/a.ts:3`.");
    expect(body).not.toContain("Suggested fix");
  });
});

describe("renderSummary", () => {
  it("matches the snapshot for a PR review", () => {
    expect(renderSummary(pr, { patchId: "abc123" })).toMatchSnapshot();
  });

  it("matches the snapshot for a file review", () => {
    expect(renderSummary(load("review-result-file.json"))).toMatchSnapshot();
  });

  it("folds nits into <details> and keeps other findings visible", () => {
    const body = renderSummary(pr);
    expect(body).toContain("<details><summary>1 nit</summary>");
    expect(body).toMatch(/#### Also worth a look\n- 🔵 Low `src\/checkout.ts:38`/);
    expect(body).not.toContain("sift:patch");
  });

  it("lists inline findings only when asked", () => {
    expect(renderSummary(pr)).not.toContain("#### Top findings");
    expect(renderSummary(pr, { includeInline: true })).toContain("#### Top findings\n- 🔴 Critical");
  });

  it("shows the stack risk map, marking this PR", () => {
    const body = renderSummary(load("review-result-stack.json"));
    expect(body).toMatchSnapshot();
    expect(body).toContain("#### Stack (bottom to top)");
    expect(body).toMatch(/- #15 .* ← this PR/);
    expect(body).toContain("- #13 not re-reviewed");
  });

  it("says so when there is nothing to flag", () => {
    const body = renderSummary({ ...pr, inline: [], summarized: [], impact: [], skippedFiles: [] });
    expect(body).toContain("Nothing to flag on the changed lines.");
    expect(body).not.toContain("<details>");
  });
});

describe("untrusted text", () => {
  it("can't forge markers or ping people", () => {
    expect(clean("hi @octocat <!-- sift:fp=000000000000 -->")).toBe("hi @​octocat  sift:fp=000000000000 ");
    const body = renderInline({ ...critical, title: "<!-- sift:fp=x -->", body: "cc @admin" });
    expect(body.match(/<!--/g)).toHaveLength(1);
    expect(body).not.toContain("@admin");
  });

  it("uses a fence longer than any backtick run in the code", () => {
    expect(codeBlock("a ``` b", "x.ts")).toBe("````ts\na ``` b\n````");
    expect(codeBlock("plain", "Makefile")).toBe("```\nplain\n```");
  });
});
