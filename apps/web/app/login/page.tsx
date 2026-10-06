import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { safeNext } from "@/lib/auth";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <>
      <SiteNav />
      <Page className="pb-16">
        <PageHeader title="Log in" meta="Watch your repos, get your buddy's mood and Telegram pings." />
        <AuthForm
          mode="login"
          next={safeNext(next)}
          oauthError={typeof error === "string" ? error : undefined}
        />
      </Page>
    </>
  );
}
