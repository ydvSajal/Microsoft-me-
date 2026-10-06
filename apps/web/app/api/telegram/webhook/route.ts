import { z } from "zod";
import { db } from "@/lib/db";
import { env, readBody, requireToken } from "@/lib/http";
import { parseCommand, sendMessage } from "@/lib/telegram";

// Only the fields we read; Telegram sends many more.
const Update = z.object({
  message: z.object({ chat: z.object({ id: z.number() }), text: z.string().optional() }).optional(),
});

/** Telegram → us. Secret header first; every other update gets a 200 so Telegram stops retrying. */
export async function POST(req: Request) {
  const denied = requireToken(
    req.headers.get("x-telegram-bot-api-secret-token"),
    env("TELEGRAM_WEBHOOK_SECRET"),
    "",
  );
  if (denied) return denied;
  const body = await readBody(req, Update);
  if (!body.ok || !body.data.message) return new Response(null, { status: 200 });
  const chatId = String(body.data.message.chat.id);
  const cmd = parseCommand(body.data.message.text);
  const bot = env("TELEGRAM_BOT_TOKEN");
  const reply = (text: string) => (bot ? sendMessage(bot, chatId, text) : Promise.resolve(false));
  try {
    const prisma = db();
    if (cmd?.kind === "start") {
      const user = await prisma.user.findUnique({ where: { linkToken: cmd.token }, select: { id: true } });
      if (!user) {
        await reply("That link has expired. Open Settings on Sift and press Connect Telegram again.");
      } else {
        // One chat per account: free this chat from any other account first.
        await prisma.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramChatId: chatId, linkToken: null },
        });
        await reply(
          "✅ Linked. You'll get Sift's review of every PR in the repos you watch. Send /stop to unlink.",
        );
      }
    } else if (cmd?.kind === "stop") {
      await prisma.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
      await reply("Unlinked. No more pings.");
    }
  } catch (err) {
    console.error("telegram webhook failed:", err instanceof Error ? err.message : String(err));
  }
  return new Response(null, { status: 200 });
}
