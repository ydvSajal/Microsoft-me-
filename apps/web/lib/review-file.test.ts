import { mockModel } from "@sift/ai/mock";
import { describe, expect, it } from "vitest";
import { REVIEW_FILE_MAX_LINES } from "./config";
import { ReviewFileInput, reviewFile } from "./review-file";

const finding = (over: Record<string, unknown>) => ({
  line: 2,
  severity: "high",
  category: "bug",
  ruleKey: "missing-await",
  title: "Not awaited",
  body: "Explained.",
  quotedCode: "const t = cart.getTotal();",
  confidence: 0.9,
  ...over,
});

describe("ReviewFileInput", () => {
  it("accepts a small TS file", () => {
    expect(ReviewFileInput.safeParse({ filename: "a.ts", content: "x\n" }).success).toBe(true);
  });

  it.each([
    [{ filename: "a.py", content: "x" }, "filename"],
    [{ filename: "a.ts", content: "" }, "content"],
    [{ filename: "a.ts", content: "x\n".repeat(REVIEW_FILE_MAX_LINES + 1) }, "content"],
  ])("rejects %#", (input, field) => {
    const r = ReviewFileInput.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual([field]);
  });

  it("allows exactly the line limit, trailing newline included", () => {
    const content = "x\n".repeat(REVIEW_FILE_MAX_LINES);
    expect(ReviewFileInput.safeParse({ filename: "a.ts", content }).success).toBe(true);
  });
});

describe("reviewFile", () => {
  it("runs one model call and returns a ranked file-mode result", async () => {
    const model = mockModel([
      JSON.stringify({
        whatChanged: "Checkout totals the cart.",
        findings: [
          finding({}),
          finding({ severity: "nit", category: "style", ruleKey: "quotes", quotedCode: "x" }),
        ],
      }),
    ]);
    const r = await reviewFile(
      { filename: "src/a.ts", content: "import x;\nconst t = cart.getTotal();\n" },
      { model },
    );
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("File: src/a.ts");
    expect(r).toMatchObject({ mode: "file", riskTier: "high", stats: { llmCalls: 1 } });
    expect(r.inline.map((f) => f.ruleKey)).toEqual(["missing-await"]);
    expect(r.summarized.map((f) => f.ruleKey)).toEqual(["quotes"]);
  });
});
