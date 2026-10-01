import { ReviewResult } from "@sift/shared";
import demoReview from "@sift/shared/fixtures/review-result-pr.json";
import { ReviewCard } from "@/components/review-card";
import { ButtonLink, Logo, Page, Panel, RiskBadge, SiteNav } from "@/components/ui";

// The hero shows a real Sift component rendering a real review result (the shared demo fixture),
// not a mock screenshot.
const review = ReviewResult.parse(demoReview);

const STEPS = [
  ["Map the diff", "Every changed line on the right side of the PR becomes a place Sift may comment."],
  ["Review each file", "One model call per file, with the code around each change as context."],
  ["Check every quote", "A finding must quote code that exists. Invented quotes are dropped."],
  ["Rank and fold", "Severity times confidence picks seven comments. Nits and repeats fold away."],
  ["Post one comment", "A single review on the exact commit, plus one risk label on the PR."],
] as const;

export default function Landing() {
  return (
    <>
      <SiteNav />
      <Page>
        <section className="grid min-h-[calc(100dvh-3.5rem)] items-center gap-12 py-16 md:py-20 lg:grid-cols-[1fr_1.1fr]">
          <div className="rise max-w-xl">
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter text-text md:text-5xl lg:text-6xl">
              Review the pull requests that matter first.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
              Sift reads every PR, keeps only findings it can ground in the diff, and labels the risk.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/review">Try a file</ButtonLink>
              <ButtonLink href="/dashboard" variant="secondary">
                Open dashboard
              </ButtonLink>
            </div>
          </div>
          <div className="rise [--i:2]">
            <ReviewCard result={review} />
          </div>
        </section>

        <section className="py-20 md:py-28">
          <h2 className="max-w-[20ch] text-3xl font-semibold tracking-tight text-text md:text-4xl">
            Less noise in every review.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Panel className="bg-accent-soft p-6 md:col-span-2">
              <h3 className="text-lg font-medium text-text">Grounded or gone</h3>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
                Every finding quotes the code it is about. If the quote isn&apos;t in the file, or the line
                isn&apos;t part of the diff, it never becomes an inline comment.
              </p>
              <code className="mt-6 block overflow-x-auto rounded-control bg-surface px-3 py-2 font-mono text-xs text-text">
                const total = cart.getTotal();
              </code>
            </Panel>
            <Panel className="flex flex-col justify-between p-6">
              <p className="font-mono text-5xl font-semibold tracking-tight text-accent">7</p>
              <div>
                <h3 className="mt-6 text-lg font-medium text-text">Comments, at most</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Ranked by severity and confidence. Everything else waits in the summary.
                </p>
              </div>
            </Panel>
            <Panel className="p-6">
              <h3 className="text-lg font-medium text-text">Never the same comment twice</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Each comment carries a fingerprint. Later pushes and stacked PRs skip what was already said.
              </p>
              <code className="mt-6 block truncate font-mono text-xs text-faint">
                {"<!-- sift:fp=9bd99466492c -->"}
              </code>
            </Panel>
            <Panel className="bg-surface-2 p-6 md:col-span-2">
              <h3 className="text-lg font-medium text-text">A risk label on every PR</h3>
              <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
                Auth, payments and migrations, changed signatures with callers elsewhere, and large diffs all
                raise the tier. Seniors open the red ones first.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <RiskBadge tier="high" />
                <RiskBadge tier="medium" />
                <RiskBadge tier="low" />
              </div>
            </Panel>
          </div>
        </section>

        <section className="border-t border-line py-20 md:py-28">
          <h2 className="text-3xl font-semibold tracking-tight text-text md:text-4xl">
            What happens on each push
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-5 md:gap-6">
            {STEPS.map(([verb, detail], i) => (
              <li key={verb} className="relative md:pt-6">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 hidden h-px md:block ${i === 0 ? "w-full bg-accent" : "w-full bg-line"}`}
                />
                <h3 className="text-base font-medium text-text">{verb}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-20 md:py-32">
          <p className="max-w-[18ch] text-4xl font-semibold leading-[1.1] tracking-tighter text-text md:text-6xl">
            Sift only comments. A person approves.
          </p>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-muted">
            The review event is always COMMENT. Approving and requesting changes stay with your team.
          </p>
        </section>

        <section className="mb-16">
          <Panel className="flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-text">See it on your own code.</h2>
              <p className="mt-2 text-sm text-muted">
                Paste a TypeScript or JavaScript file and get the review Sift would post.
              </p>
            </div>
            <ButtonLink href="/review">Try a file</ButtonLink>
          </Panel>
        </section>
      </Page>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted md:px-6">
          <Logo />
          <span>Built for Microsoft Innovate 2026</span>
        </div>
      </footer>
    </>
  );
}
