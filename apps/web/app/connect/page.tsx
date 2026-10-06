import type { Metadata } from "next";
import { Page, PageHeader, SiteNav } from "@/components/ui";
import { QUEUE_MAX_REPOS } from "@/lib/config";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Connect repos" };

export default function ConnectPage() {
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
