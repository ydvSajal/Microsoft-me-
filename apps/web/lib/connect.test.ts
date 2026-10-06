import { describe, expect, it } from "vitest";
import { allState, filterRepos, type RepoRow, toggleAll } from "./connect";

const repo = (fullName: string, enabled = false): RepoRow => ({
  fullName,
  private: true,
  language: null,
  enabled,
});
const repos = [repo("o/shop"), repo("o/api"), repo("x/Shopify")];

describe("filterRepos", () => {
  it("matches case-insensitively on the full name and trims", () => {
    expect(filterRepos(repos, "  SHOP ").map((r) => r.fullName)).toEqual(["o/shop", "x/Shopify"]);
  });
  it("returns everything for an empty query", () => {
    expect(filterRepos(repos, "")).toHaveLength(3);
  });
});

describe("allState", () => {
  it("is none, some or all of the shown repos", () => {
    expect(allState(repos, new Set())).toBe("none");
    expect(allState(repos, new Set(["o/api"]))).toBe("some");
    expect(allState(repos, new Set(repos.map((r) => r.fullName)))).toBe("all");
  });
  it("ignores picks that the filter hides", () => {
    expect(allState([repo("o/api")], new Set(["o/shop"]))).toBe("none");
  });
});

describe("toggleAll", () => {
  it("ticks only the shown repos and keeps hidden picks", () => {
    const next = toggleAll([repo("o/api")], new Set(["o/shop"]), true);
    expect([...next].sort()).toEqual(["o/api", "o/shop"]);
  });
  it("unticks only the shown repos", () => {
    const next = toggleAll([repo("o/api")], new Set(["o/api", "o/shop"]), false);
    expect([...next]).toEqual(["o/shop"]);
  });
});
