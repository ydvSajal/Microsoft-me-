// Route guards run before any database access, so these need no DB.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "@/lib/config";
import { POST as feedback } from "./ingest/feedback/route";
import { POST as review } from "./ingest/review/route";
import { POST as started } from "./ingest/review-started/route";

const SECRET = "test-ingest-secret";
const req = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  new Request("http://x/api", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  process.env.SIFT_INGEST_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SIFT_INGEST_SECRET;
});

describe.each([
  ["review-started", started],
  ["review", review],
  ["feedback", feedback],
] as const)("POST /api/ingest/%s", (_name, handler) => {
  it("401 without or with a wrong token", async () => {
    expect((await handler(req({}, null))).status).toBe(401);
    expect((await handler(req({}, "Bearer nope"))).status).toBe(401);
  });

  it("401 when the server has no secret configured", async () => {
    delete process.env.SIFT_INGEST_SECRET;
    expect((await handler(req({}))).status).toBe(401);
  });

  it("400 with field errors on a bad body", async () => {
    const res = await handler(req({ repo: 5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid");
  });

  it("413 over 1 MB", async () => {
    expect((await handler(req("x".repeat(MAX_BODY_BYTES + 1)))).status).toBe(413);
  });
});

it("review-started rejects a malformed repo name", async () => {
  const res = await started(req({ repo: "no-slash", prNumber: 1, headSha: "abc" }));
  expect(res.status).toBe(400);
});

it("review rejects file-mode results", async () => {
  const res = await review(
    req({
      mode: "file",
      riskTier: "low",
      whatChanged: "",
      inline: [],
      summarized: [],
      droppedCount: 0,
      stats: { llmCalls: 1, durationMs: 1 },
    }),
  );
  expect(res.status).toBe(400);
});
