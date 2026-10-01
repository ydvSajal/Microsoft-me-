import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sift: PR review triage", template: "%s · Sift" },
  description:
    "Sift reviews pull requests, ranks what matters, and labels risk so humans review the right PRs first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  );
}
