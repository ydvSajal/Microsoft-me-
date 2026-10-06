// Route guards run before any database access, so these need no DB.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "@/lib/config";
import { POST as feedback } from "./ingest/feedback/route";
import { POST as review } from "./ingest/review/route";
import { POST as started } from "./ingest/review-started/route";
import { GET as listReposRoute } from "./github/repos/route";
import { GET as queueGet, POST as queuePost } from "./queue/route";
import { POST as reviewFileRoute } from "./review-file/route";

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

describe("POST /api/review-file", () => {
  const passReq = (body: unknown, passcode: string | null) =>
    new Request("http://x/api/review-file", {
      method: "POST",
      body: JSON.stringify(body),
      headers: passcode ? { "x-sift-passcode": passcode } : {},
    });

  beforeEach(() => {
    process.env.SIFT_DEMO_PASSCODE = "pass";
  });
  afterEach(() => {
    delete process.env.SIFT_DEMO_PASSCODE;
  });

  it("401 without the right passcode", async () => {
    expect((await reviewFileRoute(passReq({}, null))).status).toBe(401);
    expect((await reviewFileRoute(passReq({}, "nope"))).status).toBe(401);
  });

  it("400 for non-TS files and oversize pastes, before any model call", async () => {
    const res = await reviewFileRoute(passReq({ filename: "a.py", content: "x" }, "pass"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields).toHaveProperty("filename");
  });

  it("503 when no AI provider is configured", async () => {
    const saved = { ...process.env };
    for (const k of ["SIFT_AI_PROVIDER", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENROUTER_API_KEY", "SIFT_MODEL"])
      delete process.env[k];
    const res = await reviewFileRoute(passReq({ filename: "a.ts", content: "const a = 1;" }, "pass"));
    Object.assign(process.env, saved);
    expect(res.status).toBe(503);
  });
});

describe("queue and GitHub listing routes", () => {
  const authed = (method: string, body?: unknown, passcode: string | null = "pass") =>
    new Request("http://x/api", {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      headers: passcode ? { "x-sift-passcode": passcode } : {},
    });

  beforeEach(() => {
    process.env.SIFT_DEMO_PASSCODE = "pass";
    delete process.env.SIFT_GITHUB_TOKEN;
  });
  afterEach(() => {
    delete process.env.SIFT_DEMO_PASSCODE;
  });

  it.each([
    ["GET /api/github/repos", () => listReposRoute(authed("GET", undefined, null))],
    ["POST /api/queue", () => queuePost(authed("POST", { all: true }, "nope"))],
    ["GET /api/queue", () => queueGet(authed("GET", undefined, null))],
  ])("%s → 401 without the passcode", async (_n, call) => {
    expect((await call()).status).toBe(401);
  });

  it("401 when the server has no passcode configured", async () => {
    delete process.env.SIFT_DEMO_PASSCODE;
    expect((await queuePost(authed("POST", { all: true }, "pass"))).status).toBe(401);
  });

  it("POST /api/queue → 400 with field errors on a bad body", async () => {
    const res = await queuePost(authed("POST", { repos: ["no-slash"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid");
  });

  it("POST /api/queue → 413 over 1 MB", async () => {
    expect((await queuePost(authed("POST", "x".repeat(MAX_BODY_BYTES + 1)))).status).toBe(413);
  });

  it("POST /api/queue and GET /api/github/repos → 503 when SIFT_GITHUB_TOKEN is unset", async () => {
    const post = await queuePost(authed("POST", { repos: ["o/n"] }));
    expect(post.status).toBe(503);
    expect((await post.json()).error.code).toBe("not_configured");
    expect((await listReposRoute(authed("GET"))).status).toBe(503);
  });
});
