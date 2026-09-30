import { describe, expect, it } from "vitest";
import { fingerprint, normalize } from "./fingerprint";

const base = { category: "bug", ruleKey: "missing-await", quotedCode: "const total = cart.getTotal();" };

describe("normalize", () => {
  it("trims lines, collapses whitespace and drops empty lines", () => {
    expect(normalize("  const  a =\t1;\n\n   return a;  \r\n")).toBe("const a = 1;\nreturn a;");
  });
});

describe("fingerprint", () => {
  it("is 12 hex chars and matches the fixture value", () => {
    expect(fingerprint(base)).toBe("9bd99466492c");
  });

  it("ignores whitespace and indentation differences", () => {
    expect(fingerprint({ ...base, quotedCode: "    const   total = cart.getTotal();\n" })).toBe(
      fingerprint(base),
    );
  });

  it("changes with category, ruleKey or code", () => {
    const fp = fingerprint(base);
    expect(fingerprint({ ...base, category: "performance" })).not.toBe(fp);
    expect(fingerprint({ ...base, ruleKey: "floating-promise" })).not.toBe(fp);
    expect(fingerprint({ ...base, quotedCode: "const total = await cart.getTotal();" })).not.toBe(fp);
  });
});
