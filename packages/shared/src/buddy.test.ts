import { describe, expect, it } from "vitest";
import { type BuddyInput, type BuddyPr, buddyFromFindings, computeBuddyState } from "./buddy";

const pr = (number: number, findings: BuddyPr["findings"] = [], waitingHours = 1): BuddyPr => ({
  number,
  waitingHours,
  findings,
});
const input = (over: Partial<BuddyInput> = {}): BuddyInput => ({
  snoozed: false,
  reviewing: null,
  prs: [],
  waitHours: 4,
  rev: 7,
  ...over,
});
const crit = { severity: "critical" as const, title: "SQL injection in checkout" };
const high = { severity: "high" as const, title: "Token logged in plain text" };

describe("computeBuddyState", () => {
  it("1: snoozed beats everything", () => {
    expect(computeBuddyState(input({ snoozed: true, reviewing: 3, prs: [pr(1, [crit])] }))).toMatchObject({
      mood: "sleepy",
      text: "Snoozed",
    });
  });

  it("2: a review in progress", () => {
    expect(computeBuddyState(input({ reviewing: 12, prs: [pr(1, [crit])] }))).toMatchObject({
      mood: "scanning",
      text: "Reviewing PR #12…",
    });
  });

  it("3: critical is angry, buzzes, and shows the title", () => {
    const s = computeBuddyState(input({ prs: [pr(2, [high]), pr(1, [crit])] }));
    expect(s).toMatchObject({
      mood: "angry",
      text: crit.title,
      buzz: true,
      critical: 1,
      high: 1,
      pending: 2,
    });
  });

  it("4: high is worried", () => {
    expect(computeBuddyState(input({ prs: [pr(1, [high])] }))).toMatchObject({
      mood: "worried",
      buzz: false,
    });
  });

  it("5: a PR waiting past WAIT_HOURS is impatient", () => {
    const s = computeBuddyState(input({ prs: [pr(2, [{ severity: "low", title: "x" }]), pr(1, [], 5.5)] }));
    expect(s).toMatchObject({ mood: "impatient", text: "#1 waiting 5h" });
  });

  it("6: medium or only nits is meh", () => {
    expect(computeBuddyState(input({ prs: [pr(4, [{ severity: "nit", title: "x" }])] })).text).toBe(
      "Only nits on #4",
    );
    const s = computeBuddyState(input({ prs: [pr(4, [{ severity: "medium", title: "x" }])] }));
    expect(s).toMatchObject({ mood: "meh", text: "1 medium on #4", medium: 1 });
  });

  it("7: clean latest review is happy", () => {
    expect(computeBuddyState(input({ prs: [pr(9)] }))).toMatchObject({
      mood: "happy",
      text: "#9 looks clean",
    });
  });

  it("8: nothing pending is sleepy", () => {
    expect(computeBuddyState(input())).toMatchObject({
      mood: "sleepy",
      text: "Queue empty",
      pending: 0,
      rev: 7,
    });
  });

  it("clips text to 40 characters", () => {
    const s = computeBuddyState(input({ prs: [pr(1, [{ severity: "critical", title: "x".repeat(60) }])] }));
    expect(s.text).toHaveLength(40);
  });

  it("drops markdown backticks", () => {
    const s = computeBuddyState(
      input({ prs: [pr(1, [{ severity: "high", title: "`getTotal()` is async" }])] }),
    );
    expect(s.text).toBe("getTotal() is async");
  });
});

describe("buddyFromFindings", () => {
  it("talks about the file, not a PR number", () => {
    expect(buddyFromFindings([])).toMatchObject({ mood: "happy", text: "this file looks clean" });
    expect(buddyFromFindings([crit, high]).mood).toBe("angry");
  });
});
