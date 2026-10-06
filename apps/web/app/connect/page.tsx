import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { Page, PageHeader } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { QUEUE_MAX_REPOS } from "@/lib/config";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Connect repos" };

export default async function ConnectPage() {
  if (!(await getUser())) redirect("/login?next=/connect");
  return (
    <>
      <SiteNav current="/connect" />
      <Page className="pb-16">
        <PageHeader
          title="Connect repositories"
          meta="Pick the repositories Sift should review. Every open pull request in a picked repository goes into the review queue."
        />
        <ConnectForm maxRepos={QUEUE_MAX_REPOS} />
      </Page>
    </>
  );
}
