import type { Metadata } from "next";
import { Page, PageHeader, SiteNav } from "@/components/ui";
import { REVIEW_FILE_MAX_LINES } from "@/lib/config";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Try a file" };

export default function ReviewPage() {
  return (
    <>
      <SiteNav current="/review" />
      <Page className="pb-16">
        <PageHeader
          title="Try a file"
          meta={`Paste up to ${REVIEW_FILE_MAX_LINES} lines of TypeScript or JavaScript. Sift reviews it the same way the CLI does.`}
        />
        <ReviewForm maxLines={REVIEW_FILE_MAX_LINES} />
      </Page>
    </>
  );
}
