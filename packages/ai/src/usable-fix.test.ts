import { describe, expect, it } from "vitest";
import { isUsableFix } from "./usable-fix";

const quote = "const total = cart.getTotal();";

describe("isUsableFix", () => {
  it("accepts a real fix", () => {
    expect(isUsableFix(quote, "const total = await cart.getTotal();")).toBe(true);
  });

  it("accepts a multi-line fix with strings, templates, regex and comments", () => {
    const fix = [
      "const m = /[(]+/.exec(`a ${b} (`);",
      "// note: ) is fine in a comment",
      'if (m) { log("}"); }',
    ].join("\n");
    expect(isUsableFix(quote, fix)).toBe(true);
  });

  it("rejects empty, whitespace-only and missing fixes", () => {
    expect(isUsableFix(quote, undefined)).toBe(false);
    expect(isUsableFix(quote, "")).toBe(false);
    expect(isUsableFix(quote, "  \n ")).toBe(false);
  });

  it("rejects a fix identical to the quote, ignoring whitespace", () => {
    expect(isUsableFix(quote, "const  total =\n cart.getTotal();")).toBe(false);
  });

  it("rejects unbalanced brackets and unclosed strings", () => {
    expect(isUsableFix(quote, "const total = (await cart.getTotal();")).toBe(false);
    expect(isUsableFix(quote, "const total = await cart.getTotal());")).toBe(false);
    expect(isUsableFix(quote, "const total = '5;")).toBe(false);
    expect(isUsableFix(quote, "const t = `abc ${x}")).toBe(false);
    expect(isUsableFix(quote, "const t = 1; /* open")).toBe(false);
  });

  it("rejects a diff hunk", () => {
    expect(isUsableFix(quote, "@@ -1,2 +1,2 @@\n-a\n+b")).toBe(false);
    expect(isUsableFix(quote, "-const total = cart.getTotal();\n+const total = await cart.getTotal();")).toBe(
      false,
    );
  });

  it("lets a fragment fix replace a fragment quote", () => {
    expect(isUsableFix("if (total <= 0) {", "if (!(total > 0)) {")).toBe(true);
  });

  it("does not mistake division for a regex", () => {
    expect(isUsableFix(quote, "const avg = (a + b) / 2; const c = d / (e + 1);")).toBe(true);
  });
});
