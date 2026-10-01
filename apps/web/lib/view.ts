// Shapes the dashboard and landing page share, so a DB row and a ReviewResult render the same way.
import type { TFinding, TRiskTier, TSeverity } from "@sift/shared";

export type FindingView = {
  severity: TSeverity;
  category: string;
  file: string;
  line: number;
  title: string;
  confidence: number;
  placement?: "inline" | "summary" | "dropped";
  outcome?: "pending" | "accepted" | "dismissed";
};

export const lower = <T extends string>(s: string) => s.toLowerCase() as T;
export const riskOf = (dbTier: string) => lower<TRiskTier>(dbTier);

export const fromFinding = (f: TFinding, placement: FindingView["placement"]): FindingView => ({
  severity: f.severity,
  category: f.category,
  file: f.file,
  line: f.line,
  title: f.title,
  confidence: f.confidence,
  placement,
});

/** accepted / (accepted + dismissed), or null with no samples yet. */
export function precision(accepted: number, dismissed: number): number | null {
  const total = accepted + dismissed;
  return total === 0 ? null : accepted / total;
}

export const percent = (p: number) => `${Math.round(p * 100)}%`;

export function duration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago"; "just now" under a minute. */
export function ago(date: Date, now = Date.now()): string {
  const diff = date.getTime() - now;
  for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  return "just now";
}
