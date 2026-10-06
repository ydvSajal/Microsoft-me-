"use server";

import { redirect } from "next/navigation";
import { newToken } from "@/lib/auth";
import { SNOOZE_HOURS } from "@/lib/config";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { sendMessage } from "@/lib/telegram";

const HOUR_MS = 3_600_000;

async function me() {
  const user = await getUser();
  if (!user) redirect("/login?next=/settings");
  return user;
}

/** A fresh one-time token for the t.me deep link; the webhook trades it for the chat id. */
export async function connectTelegram() {
  const user = await me();
  await db().user.update({ where: { id: user.id }, data: { linkToken: newToken() } });
  redirect("/settings?msg=link");
}

export async function unlinkTelegram() {
  const user = await me();
  await db().user.update({ where: { id: user.id }, data: { telegramChatId: null, linkToken: null } });
  redirect("/settings?msg=unlinked");
}

export async function sendTestPing() {
  const user = await me();
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const ok =
    !!bot &&
    !!user.telegramChatId &&
    (await sendMessage(
      bot,
      user.telegramChatId,
      "👋 Test ping from Sift. Reviews for your watched repos land here.",
    ));
  redirect(`/settings?msg=${ok ? "sent" : "failed"}`);
}

export async function toggleSnooze() {
  const user = await me();
  const snoozed = !!user.snoozedUntil && user.snoozedUntil > new Date();
  await db().user.update({
    where: { id: user.id },
    data: { snoozedUntil: snoozed ? null : new Date(Date.now() + SNOOZE_HOURS * HOUR_MS) },
  });
  redirect("/settings");
}
