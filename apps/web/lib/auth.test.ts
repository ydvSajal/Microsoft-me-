import { describe, expect, it } from "vitest";
import { Credentials, hashPassword, safeNext, seal, unseal, verifyPassword } from "./auth";

describe("passwords", () => {
  it("verifies the right password only", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong horse", h)).toBe(false);
  });

  it("salts each hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "abcd:ef")).toBe(false);
  });
});

describe("seal", () => {
  it("round-trips", () => {
    expect(unseal(seal("gho_secret", "k1"), "k1")).toBe("gho_secret");
  });

  it("rejects a wrong key or a tampered value", () => {
    const s = seal("gho_secret", "k1");
    expect(unseal(s, "k2")).toBeNull();
    const [iv, tag, data] = s.split(".");
    expect(unseal(`${iv}.${tag}.${data?.slice(0, -2)}AA`, "k1")).toBeNull();
    expect(unseal("garbage", "k1")).toBeNull();
  });
});

describe("Credentials", () => {
  it("normalises the email and checks the password length", () => {
    expect(Credentials.parse({ email: " A@B.co ", password: "12345678" }).email).toBe("a@b.co");
    expect(Credentials.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("safeNext", () => {
  it.each([
    ["/connect", "/connect"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
