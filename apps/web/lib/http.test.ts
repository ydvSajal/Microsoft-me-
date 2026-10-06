import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_BODY_BYTES } from "./config";
import { env, readBody, requireToken, safeEqual } from "./http";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body, headers });

describe("safeEqual / requireToken", () => {
  it("compares in constant time, including different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it.each([
    ["Bearer s3cret", "s3cret", null],
    ["Bearer wrong", "s3cret", 401],
    ["s3cret", "s3cret", 401], // missing scheme
    [null, "s3cret", 401],
    ["Bearer ", "", 401], // unset secret denies everything
    ["Bearer anything", undefined, 401],
  ] as const)("%s vs %s → %s", (header, secret, status) => {
    expect(requireToken(header, secret)?.status ?? null).toBe(status);
  });

  it("supports a raw header token (the passcode header)", () => {
    expect(requireToken("1234", "1234", "")).toBeNull();
    expect(requireToken("12345", "1234", "")?.status).toBe(401);
  });
});

describe("readBody", () => {
  const Schema = z.object({ n: z.number() });

  it("returns typed data", async () => {
    const r = await readBody(post('{"n":3}'), Schema);
    expect(r).toEqual({ ok: true, data: { n: 3 } });
  });

  it("400 with field errors when invalid", async () => {
    const r = await readBody(post('{"n":"x"}'), Schema);
    if (r.ok) throw new Error("expected failure");
    expect(r.res.status).toBe(400);
    expect((await r.res.json()).error.fields).toHaveProperty("n");
  });

  it("400 on broken JSON", async () => {
    const r = await readBody(post("{nope"), Schema);
    expect(r.ok ? 0 : r.res.status).toBe(400);
  });

  it("413 over 1 MB, by header or by actual size", async () => {
    const big = `{"n":1,"pad":"${"x".repeat(MAX_BODY_BYTES)}"}`;
    const byHeader = await readBody(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) }), Schema);
    const bySize = await readBody(post(big), Schema);
    expect(byHeader.ok ? 0 : byHeader.res.status).toBe(413);
    expect(bySize.ok ? 0 : bySize.res.status).toBe(413);
  });
});

describe("env", () => {
  it("trims pasted whitespace and treats blank as unset", () => {
    process.env.SIFT_TEST_ENV = " Ov23abc\n";
    expect(env("SIFT_TEST_ENV")).toBe("Ov23abc");
    process.env.SIFT_TEST_ENV = " \n";
    expect(env("SIFT_TEST_ENV")).toBeUndefined();
    delete process.env.SIFT_TEST_ENV;
    expect(env("SIFT_TEST_ENV")).toBeUndefined();
  });
});
