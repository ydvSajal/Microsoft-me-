import { describe, expect, it, vi } from "vitest";
import { createIngest } from "./client";

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (url: string) => Response | Error) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = respond(url);
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("createIngest", () => {
  it("posts with the Bearer secret to the documented paths", async () => {
    const { impl, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    const ingest = createIngest("https://sift.example/", "s3cret", impl);
    await ingest.reviewStarted({ repo: "o/r", prNumber: 1, headSha: "abc" });
    await ingest.feedback([]); // nothing to send → no call
    expect(calls.map((c) => c.url)).toEqual(["https://sift.example/api/ingest/review-started"]);
    expect(calls[0]?.init.headers).toMatchObject({ authorization: "Bearer s3cret" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ repo: "o/r", prNumber: 1, headSha: "abc" });
  });

  it("reads muted categories and drops unknown ones", async () => {
    const { impl, calls } = fakeFetch(() => Response.json({ muted: ["style", "made-up"] }));
    expect(await createIngest("http://x", "s", impl).config("o w", "r")).toEqual(["style"]);
    expect(calls[0]?.url).toBe("http://x/api/repos/o%20w/r/config");
  });

  it("never throws: network errors and HTTP errors become warnings and defaults", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const down = createIngest("http://x", "s", fakeFetch(() => new Error("ECONNREFUSED")).impl);
    const failing = createIngest("http://x", "s", fakeFetch(() => new Response("no", { status: 500 })).impl);
    await expect(down.reviewStarted({ repo: "o/r", prNumber: 1, headSha: "a" })).resolves.toBeUndefined();
    await expect(
      failing.feedback([
        {
          repo: "o/r",
          prNumber: 1,
          fingerprint: "a".repeat(12),
          outcome: "accepted",
          source: "line-changed",
          at: new Date().toISOString(),
        },
      ]),
    ).resolves.toBeUndefined();
    expect(await down.config("o", "r")).toEqual([]);
    expect(log.mock.calls.flat().join("\n")).toContain("::warning::Sift API");
    log.mockRestore();
  });
});
