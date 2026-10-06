// Telegram pings (T-25): one app bot, raw Bot API over fetch. Formatting and parsing are pure for tests.
import type { TFinding, TReviewResult } from "@sift/shared";
import { TELEGRAM_TOP_FINDINGS, TELEGRAM_SUGGESTION_MAX } from "./config";

type Fetch = typeof fetch;

/** Telegram HTML mode only needs these three escaped. PR content is untrusted. */
export const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const RISK = { high: "🔴 High risk", medium: "🟠 Medium risk", low: "🟢 Low risk" } as const;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function findingLines(f: TFinding, i: number): string {
  const head = `${i + 1}. <b>${f.severity.toUpperCase()}</b> ${escapeHtml(f.title.replaceAll("`", ""))}\n   <code>${escapeHtml(`${f.file}:${f.line}`)}</code>`;
  return f.suggestion
    ? `${head}\n   💡 Fix:\n<pre>${escapeHtml(clip(f.suggestion, TELEGRAM_SUGGESTION_MAX))}</pre>`
    : head;
}

/** One message per ingested PR review: risk, PR, top findings with their suggested fix. */
export function formatReviewMessage(r: TReviewResult): string {
  const all = [...r.inline, ...r.summarized];
  const repo = r.repo ?? "";
  const link = `https://github.com/${repo}/pull/${r.prNumber}`;
  const lines = [
    `<b>${RISK[r.riskTier]}</b> · ${escapeHtml(repo)} <a href="${escapeHtml(link)}">#${r.prNumber}</a>`,
    `<b>${escapeHtml(r.prTitle ?? `PR #${r.prNumber}`)}</b>`,
  ];
  if (all.length === 0) return [...lines, "✅ No findings. Looks clean."].join("\n");
  lines.push(`${all.length} finding${all.length === 1 ? "" : "s"}:`, "");
  lines.push(...all.slice(0, TELEGRAM_TOP_FINDINGS).map(findingLines));
  const more = all.length - TELEGRAM_TOP_FINDINGS;
  if (more > 0) lines.push("", `+${more} more on the PR.`);
  return lines.join("\n");
}

export type BotCommand = { kind: "start"; token: string } | { kind: "stop" } | null;

/** "/start <linkToken>" from the deep link, or "/stop". Anything else is ignored. */
export function parseCommand(text: string | undefined): BotCommand {
  const m = /^\/(start|stop)(?:@\w+)?(?:\s+([\w-]{16,128}))?\s*$/.exec(text?.trim() ?? "");
  if (!m) return null;
  if (m[1] === "stop") return { kind: "stop" };
  return m[2] ? { kind: "start", token: m[2] } : null;
}

/** true when Telegram accepted it. Never throws, and never logs the bot token. */
export async function sendMessage(
  botToken: string,
  chatId: string,
  html: string,
  f: Fetch = fetch,
): Promise<boolean> {
  try {
    const res = await f(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!res.ok) console.error(`telegram sendMessage answered ${res.status}`);
    return res.ok;
  } catch {
    console.error("telegram sendMessage failed");
    return false;
  }
}
