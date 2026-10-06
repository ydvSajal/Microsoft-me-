import { readFileSync } from "node:fs";
import { ReviewResult, type TFinding } from "@sift/shared";
import { describe, expect, it, vi } from "vitest";
import { TELEGRAM_TOP_FINDINGS } from "./config";
import { escapeHtml, formatReviewMessage, parseCommand, sendMessage } from "./telegram";

const pr = ReviewResult.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/shared/src/fixtures/review-result-pr.json", import.meta.url),
      "utf8",
    ),
  ),
);
const finding = (over: Partial<TFinding>): TFinding => ({ ...(pr.inline[0] as TFinding), ...over });

describe("formatReviewMessage", () => {
  it("leads with risk, repo and PR, and links the PR", () => {
    const msg = formatReviewMessage(pr);
    expect(msg).toContain(`https://github.com/${pr.repo}/pull/${pr.prNumber}`);
    expect(msg.split("\n")[0]).toMatch(/risk/);
  });

  it("escapes PR content (it is untrusted)", () => {
    const msg = formatReviewMessage({
      ...pr,
      prTitle: "<script>alert(1)</script>",
      inline: [finding({ title: "a < b & c", suggestion: "if (a<b) {}" })],
      summarized: [],
    });
    expect(msg).not.toContain("<script>");
    expect(msg).toContain("&lt;script&gt;");
    expect(msg).toContain("a &lt; b &amp; c");
    expect(msg).toContain("<pre>if (a&lt;b) {}</pre>");
  });

  it("lists the top findings and counts the rest", () => {
    const many = Array.from({ length: TELEGRAM_TOP_FINDINGS + 2 }, (_, i) => finding({ title: `F${i}` }));
    const msg = formatReviewMessage({ ...pr, inline: many, summarized: [] });
    expect(msg).toContain("F0");
    expect(msg).not.toContain(`F${TELEGRAM_TOP_FINDINGS}`);
    expect(msg).toContain("+2 more");
  });

  it("says clean when there is nothing", () => {
    expect(formatReviewMessage({ ...pr, inline: [], summarized: [] })).toContain("Looks clean");
  });
});

describe("parseCommand", () => {
  const token = "AbCdEfGhIjKlMnOpQrSt_-12";
  it.each([
    [`/start ${token}`, { kind: "start", token }],
    [`/start@SiftBot ${token}`, { kind: "start", token }],
    ["/stop", { kind: "stop" }],
    ["/start", null],
    ["/start short", null],
    ["hello", null],
    [undefined, null],
  ])("%s", (text, out) => {
    expect(parseCommand(text)).toEqual(out);
  });
});

describe("sendMessage", () => {
  it("posts HTML to the bot and reports success", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await sendMessage("123:abc", "42", "<b>hi</b>", f)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "42", parse_mode: "HTML" });
  });

  it("never throws", async () => {
    expect(await sendMessage("t", "1", "x", async () => new Response("", { status: 403 }))).toBe(false);
    expect(
      await sendMessage("t", "1", "x", async () => {
        throw new Error("network");
      }),
    ).toBe(false);
  });
});

it("escapeHtml", () => {
  expect(escapeHtml("<a&b>")).toBe("&lt;a&amp;b&gt;");
});
