import { describe, expect, it } from "vitest";
import { groundFinding } from "./grounding";

const file = [
  "export async function checkout(cart: Cart, user: User) {", // 1
  "  const d = new Date();", // 2
  "  const total = cart.getTotal();", // 3
  "", // 4
  "  if (total <= 0) {", // 5
  "    throw new Error('Empty cart');", // 6
  "  }", // 7
  "  const total2 = cart.getTotal();", // 8
  "  return charge(user, total);", // 9
  "}", // 10
];
const f = (line: number, quotedCode: string) => ({ line, quotedCode, title: "t" });

describe("groundFinding", () => {
  it("keeps an exact quote on a commentable line inline", () => {
    expect(groundFinding(f(3, "const total = cart.getTotal();"), file, new Set([3]))).toEqual({
      finding: f(3, "const total = cart.getTotal();"),
      placement: "inline",
    });
  });

  it("matches despite whitespace differences", () => {
    const g = groundFinding(f(3, "const   total =\tcart.getTotal();  "), file, new Set([3]));
    expect(g?.placement).toBe("inline");
  });

  it("accepts a quote that is only part of a line", () => {
    expect(groundFinding(f(9, "charge(user, total)"), file, new Set([9]))?.placement).toBe("inline");
  });

  it("drops a finding whose quote isn't in the file", () => {
    expect(groundFinding(f(3, "const total = await cart.getTotal();"), file, new Set([3]))).toBeNull();
    expect(groundFinding(f(3, "   \n  "), file, new Set([3]))).toBeNull();
  });

  it("snaps an off-by-a-few line onto where the quote really is", () => {
    const g = groundFinding(f(5, "const d = new Date();"), file, new Set([2]));
    expect(g).toEqual({ finding: f(2, "const d = new Date();"), placement: "inline" });
  });

  it("picks the occurrence nearest the cited line when the quote repeats", () => {
    expect(groundFinding(f(9, "cart.getTotal();"), file, new Set([3, 8]))?.finding.line).toBe(8);
    expect(groundFinding(f(2, "cart.getTotal();"), file, new Set([3, 8]))?.finding.line).toBe(3);
  });

  it("matches a multi-line quote across a blank line", () => {
    const quote = "const total = cart.getTotal();\n\nif (total <= 0) {";
    const g = groundFinding(f(3, quote), file, new Set([5]));
    expect(g).toEqual({ finding: f(5, quote), placement: "inline" });
  });

  it("moves a real but off-diff finding to the summary", () => {
    expect(groundFinding(f(3, "const total = cart.getTotal();"), file, new Set([9]))).toEqual({
      finding: f(3, "const total = cart.getTotal();"),
      placement: "summary",
    });
  });

  it("keeps the cited line when it sits inside a multi-line span", () => {
    const quote = "if (total <= 0) {\nthrow new Error('Empty cart');";
    expect(groundFinding(f(6, quote), file, new Set([5, 6]))?.finding.line).toBe(6);
  });

  it("never inlines on an empty diff map (removed/binary file)", () => {
    expect(groundFinding(f(3, "const total"), file, new Set())?.placement).toBe("summary");
  });
});
