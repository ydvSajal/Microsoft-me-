import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiffMap } from "../diff/diff-map";
import { IMPACT_REFS_PER_SYMBOL } from "../config";
import { analyzeImpact, impactContext } from "./impact";

const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  include: ["src"],
});

function repo(files: Record<string, string>, tsconfig = true): string {
  const dir = mkdtempSync(join(tmpdir(), "sift-impact-"));
  for (const [path, text] of Object.entries({
    ...(tsconfig ? { "tsconfig.json": TSCONFIG } : {}),
    ...files,
  })) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const diff = (entries: Record<string, number[]>): DiffMap =>
  new Map(Object.entries(entries).map(([f, lines]) => [f, new Set(lines)]));

const CART = [
  "export class Cart {", // 1
  "  items: number[] = [];", // 2
  "  async getTotal(): Promise<number> {", // 3
  "    return this.items.reduce((a, b) => a + b, 0);", // 4
  "  }", // 5
  "  count(): number {", // 6
  "    return this.items.length;", // 7
  "  }", // 8
  "}", // 9
].join("\n");
const CHECKOUT = [
  'import { Cart } from "./cart";', // 1
  "export function checkout(cart: Cart) {", // 2
  "  const total = cart.getTotal();", // 3
  "  return total;", // 4
  "}", // 5
].join("\n");
const REPORT = ['import { Cart } from "./cart";', "export const n = (c: Cart) => c.count();"].join("\n");

const run = (ws: string, changed: Record<string, number[]>) =>
  analyzeImpact({ workspace: ws, changedFiles: new Set(Object.keys(changed)), diffMap: diff(changed) });

describe("analyzeImpact", () => {
  const ws = repo({ "src/cart.ts": CART, "src/checkout.ts": CHECKOUT, "src/report.ts": REPORT });

  it("finds uses outside the diff of a changed method, with the source line", () => {
    const refs = run(ws, { "src/cart.ts": [3] });
    expect(refs).toContainEqual({
      symbol: "Cart.getTotal",
      file: "src/checkout.ts",
      line: 3,
      text: "const total = cart.getTotal();",
      declFile: "src/cart.ts",
      signatureChanged: true,
    });
    expect(refs.some((r) => r.symbol === "Cart.count")).toBe(false); // line 3 isn't in count()
  });

  it("reports the class itself only for lines outside its methods", () => {
    expect(run(ws, { "src/cart.ts": [3] }).some((r) => r.symbol === "Cart")).toBe(false);
    const classLine = run(ws, { "src/cart.ts": [2] }).filter((r) => r.symbol === "Cart");
    expect(classLine.length).toBeGreaterThan(0);
    expect(classLine.every((r) => r.signatureChanged)).toBe(true);
  });

  it("flags a body-only change as not a signature change", () => {
    const refs = run(ws, { "src/cart.ts": [4] });
    expect(refs.filter((r) => r.symbol === "Cart.getTotal").every((r) => !r.signatureChanged)).toBe(true);
    expect(refs.length).toBeGreaterThan(0);
  });

  it("ignores uses in files the PR also changes, and import lines", () => {
    const refs = run(ws, { "src/cart.ts": [3], "src/checkout.ts": [3] });
    expect(refs.map((r) => r.file)).not.toContain("src/checkout.ts");
    const all = run(ws, { "src/cart.ts": [1] });
    expect(all.every((r) => !r.text.startsWith("import"))).toBe(true);
  });

  it("reports nothing when the diff doesn't touch an exported declaration", () => {
    expect(run(ws, { "src/checkout.ts": [4] })).toEqual([]);
    expect(run(ws, { "README.md": [1] })).toEqual([]);
  });

  it("covers exported functions, consts and types", () => {
    const lib = repo({
      "src/lib.ts":
        "export function f() { return 1; }\nexport const g = () => 2;\nexport type T = { a: number };\n",
      "src/use.ts": 'import { f, g, type T } from "./lib";\nexport const x: T = { a: f() + g() };\n',
    });
    const symbols = run(lib, { "src/lib.ts": [1, 2, 3] }).map((r) => r.symbol);
    expect(new Set(symbols)).toEqual(new Set(["f", "g", "T"]));
  });

  it(`caps references per symbol at ${IMPACT_REFS_PER_SYMBOL}`, () => {
    const files: Record<string, string> = { "src/lib.ts": "export function f() { return 1; }\n" };
    for (let i = 0; i < 15; i++)
      files[`src/u${String(i).padStart(2, "0")}.ts`] =
        `import { f } from "./lib";\nexport const v${i} = f();\n`;
    const refs = run(repo(files), { "src/lib.ts": [1] });
    expect(refs).toHaveLength(IMPACT_REFS_PER_SYMBOL);
    expect(refs[0]?.file).toBe("src/u00.ts"); // deterministic order
  });

  it("works without a tsconfig", () => {
    const bare = repo({ "src/cart.ts": CART, "src/checkout.ts": CHECKOUT }, false);
    expect(run(bare, { "src/cart.ts": [3] }).map((r) => r.file)).toEqual(["src/checkout.ts"]);
  });

  it("skips node_modules and generated paths", () => {
    const noisy = repo({
      "src/lib.ts": "export function f() { return 1; }\n",
      "src/dist/gen.ts": 'import { f } from "../lib";\nexport const a = f();\n',
    });
    expect(run(noisy, { "src/lib.ts": [1] })).toEqual([]);
  });
});

describe("impactContext", () => {
  it("lists the uses for the declaring file only", () => {
    const impact = run(repo({ "src/cart.ts": CART, "src/checkout.ts": CHECKOUT }), { "src/cart.ts": [3] });
    expect(impactContext(impact, "src/cart.ts")).toContain(
      "- Cart.getTotal is used at src/checkout.ts:3: const total = cart.getTotal();",
    );
    expect(impactContext(impact, "src/other.ts")).toBeUndefined();
  });
});
