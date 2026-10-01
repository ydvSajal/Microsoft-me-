import { Page, Panel, SiteNav, Skeleton } from "./ui";

/** Skeleton in the shape of the dashboard pages (header, list panel, side panel). */
export function DashboardLoading() {
  return (
    <>
      <SiteNav current="/dashboard" />
      <Page className="pb-16">
        <div className="py-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-80" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Panel className="grid gap-4 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </Panel>
          <Panel className="grid gap-3 self-start p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </Panel>
        </div>
      </Page>
    </>
  );
}
