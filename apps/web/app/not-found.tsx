import { ButtonLink, EmptyState, Page, SiteNav } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <Page className="py-16">
        <EmptyState title="Nothing here">
          That repository or pull request hasn&apos;t been reviewed by Sift.
          <div className="mt-6">
            <ButtonLink href="/dashboard" variant="secondary">
              Open dashboard
            </ButtonLink>
          </div>
        </EmptyState>
      </Page>
    </>
  );
}
