import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { Page, PageHeader } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { QUEUE_MAX_REPOS } from "@/lib/config";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Connect repos" };

export default async function ConnectPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/connect");
  return (
    <>
      <SiteNav current="/connect" />
      <Page className="pb-16">
        <PageHeader
          title="Connect repositories"
          meta="Pick the repositories to watch. Their open pull requests go into the review queue, and your buddy and Telegram pings follow them."
        />
        <ConnectForm maxRepos={QUEUE_MAX_REPOS} githubLinked={user.githubToken !== null} />
      </Page>
    </>
  );
}
