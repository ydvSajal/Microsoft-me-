import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceReader } from "./workspace";

describe("workspaceReader", () => {
  const root = mkdtempSync(join(tmpdir(), "sift-reader-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), "one\r\ntwo\n");
  writeFileSync(join(tmpdir(), "sift-outside.txt"), "secret\n");
  const read = workspaceReader(root);

  it("returns the file's lines without the trailing newline", async () => {
    expect(await read("src/a.ts")).toEqual(["one", "two"]);
  });

  it("returns null for a missing file", async () => {
    expect(await read("src/nope.ts")).toBeNull();
  });

  it("refuses paths that escape the checkout", async () => {
    expect(await read("../sift-outside.txt")).toBeNull();
    expect(await read(join(tmpdir(), "sift-outside.txt"))).toBeNull();
  });
});
