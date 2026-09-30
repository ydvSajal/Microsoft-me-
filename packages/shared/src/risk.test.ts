import { describe, expect, it } from "vitest";
import { riskFromSeverities } from "./risk";

describe("riskFromSeverities", () => {
  it.each([
    [["critical"], "high"],
    [["low", "high"], "high"],
    [["nit", "medium"], "medium"],
    [["low", "nit"], "low"],
    [[], "low"],
  ] as const)("%j → %s", (severities, tier) => {
    expect(riskFromSeverities(severities)).toBe(tier);
  });
});
