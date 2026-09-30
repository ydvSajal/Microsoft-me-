import { describe, expect, it } from "vitest";
import { loadFixture, prEvent } from "../testing";
import { PrEvent, skipReason } from "./event";

describe("PrEvent", () => {
  it("parses a real-shaped pull_request payload", () => {
    const e = prEvent();
    expect(e.pull_request.number).toBe(12);
    expect(e.pull_request.head.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(e.pull_request.requested_reviewers.map((r) => r.login)).toEqual(["senior-a", "senior-b"]);
  });

  it("defaults draft and reviewers when GitHub omits them", () => {
    const raw = structuredClone(loadFixture("pr-event.json")) as { pull_request: Record<string, unknown> };
    delete raw.pull_request.draft;
    delete raw.pull_request.requested_reviewers;
    const e = PrEvent.parse(raw);
    expect(e.pull_request.draft).toBe(false);
    expect(e.pull_request.requested_reviewers).toEqual([]);
  });

  it("rejects a payload without a pull request", () => {
    expect(() => PrEvent.parse({ repository: { name: "x", owner: { login: "y" } } })).toThrow();
  });
});

describe("skipReason", () => {
  it("reviews a normal same-repo PR", () => {
    expect(skipReason("pull_request", prEvent())).toBeNull();
  });

  it("skips drafts", () => {
    const e = prEvent();
    e.pull_request.draft = true;
    expect(skipReason("pull_request", e)).toBe("draft PR");
  });

  it("skips fork PRs, whose token is read-only", () => {
    const e = prEvent();
    e.pull_request.head.repo = { full_name: "someone/sift-demo-shop" };
    expect(skipReason("pull_request", e)).toMatch(/fork PR/);
  });

  it("skips PRs whose head repo was deleted", () => {
    const e = prEvent();
    e.pull_request.head.repo = null;
    expect(skipReason("pull_request", e)).toMatch(/fork PR/);
  });

  it("skips non-pull_request events (comment events are for feedback)", () => {
    expect(skipReason("pull_request_review_comment", prEvent())).toMatch(/not a pull_request/);
    expect(skipReason(undefined, prEvent())).toMatch(/unknown/);
  });
});
