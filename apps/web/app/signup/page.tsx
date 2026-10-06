import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { safeNext } from "@/lib/auth";
import { AuthForm } from "../login/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, error } = await searchParams;
  return (
    <>
      <SiteNav />
      <Page className="pb-16">
        <PageHeader
          title="Create your account"
          meta="Use GitHub to pick repos from your account, or an email to start."
        />
        <AuthForm
          mode="signup"
          next={safeNext(next)}
          oauthError={typeof error === "string" ? error : undefined}
        />
      </Page>
    </>
  );
}
