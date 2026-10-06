// After a PR review is ingested, ping everyone watching that repo on Telegram (T-25).
import type { TReviewResult } from "@sift/shared";
import { db } from "./db";
import { formatReviewMessage, sendMessage } from "./telegram";
import { env } from "./http";

/** Best effort: logs and moves on, so a Telegram problem never fails an ingest. */
export async function notifyWatchers(repo: { owner: string; name: string }, r: TReviewResult) {
  const bot = env("TELEGRAM_BOT_TOKEN");
  if (!bot) return;
  try {
    const now = new Date();
    const users = await db().user.findMany({
      where: {
        telegramChatId: { not: null },
        watches: { some: { repo } },
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
      },
      select: { telegramChatId: true },
    });
    const text = formatReviewMessage(r);
    await Promise.all(users.map((u) => sendMessage(bot, u.telegramChatId as string, text)));
  } catch (err) {
    console.error("telegram notify failed:", err instanceof Error ? err.message : String(err));
  }
}
