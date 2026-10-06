// The Sift component kit. Landing, dashboard and paste page all build from these, on the tokens in
// app/globals.css, so every surface shares one look. Server-safe: no hooks, no client JS.
import { SEVERITY_DEFINITIONS, type TRiskTier, type TSeverity } from "@sift/shared";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { FindingView } from "@/lib/view";
import { percent } from "@/lib/view";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Wordmark plus a simple three-bar mark: findings going in wide, coming out narrow. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-text">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-accent" fill="currentColor">
        <rect x="1" y="2" width="14" height="2.5" rx="1.25" />
        <rect x="3.5" y="6.75" width="9" height="2.5" rx="1.25" />
        <rect x="6" y="11.5" width="4" height="2.5" rx="1.25" />
      </svg>
      sift
    </span>
  );
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/review", label: "Try a file" },
  { href: "/connect", label: "Connect repos" },
] as const;

export type NavHref = (typeof NAV)[number]["href"];

/** Pages use components/site-nav.tsx, which fills `account` from the session. */
export function NavBar({ current, account }: { current?: NavHref; account?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Sift home">
          <Logo />
        </Link>
        <ul className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current === item.href ? "page" : undefined}
                className={cx(
                  "rounded-control px-3 py-1.5 transition-colors",
                  current === item.href ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          {account && <li className="ml-2 border-l border-line pl-3">{account}</li>}
        </ul>
      </nav>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-6xl px-4 md:px-6", className)}>{children}</main>;
}

export function Panel({ className, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-panel border border-line bg-surface shadow-panel", className)}
      {...rest}
    />
  );
}

const button = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "border border-line bg-surface text-text hover:bg-surface-2",
};

export function ButtonLink({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: keyof typeof button }) {
  return (
    <Link
      className={cx(
        "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-control px-4 text-sm font-medium transition active:scale-[0.98]",
        button[variant],
        className,
      )}
      {...rest}
    />
  );
}

export const RISK_STYLE: Record<TRiskTier, string> = {
  high: "bg-risk-high-soft text-risk-high",
  medium: "bg-risk-medium-soft text-risk-medium",
  low: "bg-risk-low-soft text-risk-low",
};

/** Same wording as the GitHub label: sift:risk-high. */
export function RiskBadge({ tier, label = true }: { tier: TRiskTier; label?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-control px-2 py-0.5 font-mono text-xs font-medium",
        RISK_STYLE[tier],
      )}
    >
      {label ? `sift:risk-${tier}` : tier}
    </span>
  );
}

const SEVERITY_STYLE: Record<TSeverity, string> = {
  critical: "text-risk-high",
  high: "text-risk-high",
  medium: "text-risk-medium",
  low: "text-muted",
  nit: "text-faint",
};

export function SeverityBadge({ severity }: { severity: TSeverity }) {
  return (
    <span
      title={SEVERITY_DEFINITIONS[severity]}
      className={cx("cursor-help font-mono text-xs font-semibold uppercase", SEVERITY_STYLE[severity])}
    >
      {severity}
      <span className="sr-only">: {SEVERITY_DEFINITIONS[severity]}</span>
    </span>
  );
}

/** Model text uses `backticks` for code; show those spans as code. React escapes everything. */
export function Inline({ text }: { text: string }) {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: segments of one immutable string
      <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[0.9em]">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

const PLACEMENT_LABEL = { inline: "inline", summary: "summary", dropped: "dropped" } as const;
const OUTCOME_STYLE = {
  pending: "text-faint",
  accepted: "text-risk-low",
  dismissed: "text-risk-high",
} as const;

export function FindingRow({ f }: { f: FindingView }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[4.5rem_1fr_auto]">
      <SeverityBadge severity={f.severity} />
      <div className="min-w-0">
        <p className="text-sm text-text">
          <Inline text={f.title} />
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-muted">
          {f.file}:{f.line} <span className="ml-2 text-faint">{f.category}</span>
        </p>
      </div>
      <div className="col-start-2 flex items-center gap-3 font-mono text-xs text-faint md:col-start-3 md:justify-end">
        <span title="confidence after the judge pass">{percent(f.confidence)}</span>
        {f.placement && <span>{PLACEMENT_LABEL[f.placement]}</span>}
        {f.outcome && <span className={OUTCOME_STYLE[f.outcome]}>{f.outcome}</span>}
      </div>
    </li>
  );
}

export function FindingList({ findings, empty }: { findings: FindingView[]; empty: string }) {
  if (findings.length === 0) return <p className="px-4 py-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {findings.map((f) => (
        <FindingRow key={`${f.file}:${f.line}:${f.title}`} f={f} />
      ))}
    </ul>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg text-text">{value}</dd>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="px-6 py-12 text-center">
      <h2 className="text-base font-medium text-text">{title}</h2>
      <div className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">{children}</div>
    </Panel>
  );
}

export function DbUnavailable() {
  return (
    <EmptyState title="The dashboard database isn't reachable">
      Reviews still post on GitHub. Set <code className="font-mono">DATABASE_URL</code> for the web app, run
      the migration, then reload.
    </EmptyState>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx("animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none", className)} />
  );
}

export function PageHeader({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">{title}</h1>
        {meta && <div className="mt-2 text-sm text-muted">{meta}</div>}
      </div>
      {children}
    </div>
  );
}
