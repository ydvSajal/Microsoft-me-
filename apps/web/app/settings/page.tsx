import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { Page, PageHeader, Panel } from "@/components/ui";
import { SNOOZE_HOURS } from "@/lib/config";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { connectTelegram, sendTestPing, toggleSnooze, unlinkTelegram } from "./actions";
import { env } from "@/lib/http";

export const metadata: Metadata = { title: "Settings" };

const MESSAGES: Record<string, { text: string; bad?: boolean }> = {
  link: { text: "Open Telegram with the button below and press Start. Then refresh this page." },
  sent: { text: "Test ping sent. Check Telegram." },
  failed: { text: "Telegram didn't take the test ping. Is the bot configured and still linked?", bad: true },
  unlinked: { text: "Telegram unlinked." },
};

const primary =
  "inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-110";
const secondary =
  "inline-flex h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await getUser();
  if (!user) redirect("/login?next=/settings");
  const { msg } = await searchParams;
  const note = typeof msg === "string" ? MESSAGES[msg] : undefined;
  const watching = await db()
    .userRepo.findMany({
      where: { userId: user.id },
      select: { repo: { select: { owner: true, name: true } } },
    })
    .catch(() => []);
  const bot = env("TELEGRAM_BOT_USERNAME");
  const botReady = !!bot && !!env("TELEGRAM_BOT_TOKEN");
  const snoozed = !!user.snoozedUntil && user.snoozedUntil > new Date();

  return (
    <>
      <SiteNav />
      <Page className="pb-16">
        <PageHeader title="Settings" meta={user.email ?? user.githubLogin ?? ""} />
        {note && (
          <p
            role="status"
            className={`mb-6 rounded-control px-3 py-2 text-sm ${note.bad ? "bg-risk-high-soft text-risk-high" : "bg-accent-soft text-accent"}`}
          >
            {note.text}
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          <Panel className="grid content-start gap-3 p-5">
            <h2 className="font-semibold">Telegram</h2>
            {!botReady ? (
              <p className="text-sm text-muted">
                The Telegram bot isn't configured on this server yet (TELEGRAM_BOT_TOKEN,
                TELEGRAM_BOT_USERNAME).
              </p>
            ) : user.telegramChatId ? (
              <>
                <p className="text-sm text-muted">
                  Linked. Every review of a repo you watch is sent to your chat, with the top findings and
                  fixes.
                  {snoozed &&
                    ` Snoozed until ${user.snoozedUntil?.toLocaleTimeString("en-GB", { timeStyle: "short" })}.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={sendTestPing}>
                    <button type="submit" className={primary}>
                      Send test ping
                    </button>
                  </form>
                  <form action={toggleSnooze}>
                    <button type="submit" className={secondary}>
                      {snoozed ? "Resume pings" : `Snooze ${SNOOZE_HOURS}h`}
                    </button>
                  </form>
                  <form action={unlinkTelegram}>
                    <button type="submit" className={secondary}>
                      Unlink
                    </button>
                  </form>
                </div>
              </>
            ) : user.linkToken ? (
              <>
                <p className="text-sm text-muted">Press Start in Telegram, then refresh this page.</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://t.me/${encodeURIComponent(bot)}?start=${user.linkToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className={primary}
                  >
                    Open @{bot}
                  </a>
                  <Link href="/settings" className={secondary}>
                    Refresh
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Get Sift's review of every PR in the repos you watch: risk, top findings and the suggested
                  fix.
                </p>
                <form action={connectTelegram}>
                  <button type="submit" className={primary}>
                    Connect Telegram
                  </button>
                </form>
              </>
            )}
          </Panel>

          <Panel className="grid content-start gap-3 p-5">
            <h2 className="font-semibold">GitHub and repos</h2>
            <p className="text-sm text-muted">
              {user.githubLogin ? `Linked as ${user.githubLogin}.` : "GitHub isn't linked yet."} Watching{" "}
              {watching.length} {watching.length === 1 ? "repo" : "repos"}
              {watching.length > 0 && `: ${watching.map((w) => `${w.repo.owner}/${w.repo.name}`).join(", ")}`}
              .
            </p>
            <div className="flex flex-wrap gap-2">
              {!user.githubLogin && (
                <a href="/api/auth/github?next=/settings" className={primary}>
                  Link GitHub
                </a>
              )}
              <Link href="/connect" className={secondary}>
                Pick repos
              </Link>
            </div>
          </Panel>
        </div>
      </Page>
    </>
  );
}
