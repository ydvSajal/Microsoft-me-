"use client";

import type { TFinding, TRiskTier } from "@sift/shared";
import { useState } from "react";
import { promptForFile, promptForFinding } from "@/lib/fix-prompt";
import { RISK_STYLE } from "./ui";

/** The risk badge as a button: shows how many fixes Sift suggests and toggles the panel below it. */
export function RiskButton({
  tier,
  open,
  pending,
  onToggle,
}: {
  tier: TRiskTier;
  open: boolean;
  pending: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="fix-panel"
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-control px-2.5 py-1 font-mono text-xs font-medium transition hover:brightness-95 ${RISK_STYLE[tier]}`}
    >
      sift:risk-{tier}
      <span className="rounded-control bg-surface px-1.5 text-text">
        {pending > 0 ? `${pending} ${pending === 1 ? "fix" : "fixes"}` : "all applied"}
      </span>
      <span aria-hidden="true" className={`transition-transform ${open ? "rotate-90" : ""}`}>
        ›
      </span>
    </button>
  );
}

const small =
  "inline-flex h-8 items-center justify-center rounded-control px-3 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50";

export function FixPanel({
  fixes,
  all,
  applied,
  filename,
  content,
  message,
  onApply,
  onApplyAll,
  onRereview,
}: {
  fixes: TFinding[];
  /** Every finding in the review, with or without a fix (for the all-in-one prompt). */
  all: TFinding[];
  applied: ReadonlySet<string>;
  filename: string;
  content: string;
  message: string;
  onApply: (f: TFinding) => void;
  onApplyAll: () => void;
  onRereview: () => void;
}) {
  const [note, setNote] = useState("");
  const pending = fixes.filter((f) => !applied.has(f.fingerprint)).length;

  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(done);
    } catch {
      setNote("Copy isn't available here. Select the text and copy it.");
    }
  }
  const copy = () => copyText(content, "Corrected code copied.");

  function download() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.split("/").pop() || "corrected.ts";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div id="fix-panel" className="border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text">Suggested improvements</p>
          <p className="text-xs text-muted">Preview each change, then apply it to your code on the left.</p>
        </div>
        <button
          type="button"
          onClick={onApplyAll}
          disabled={pending === 0}
          className={`${small} bg-accent text-accent-ink hover:brightness-110`}
        >
          Apply all
        </button>
      </div>

      {fixes.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted">
          Sift has no concrete fixes for this file. Suggestions come with bug, security and breaking-change
          findings.
        </p>
      ) : (
        <ul className="grid gap-3 px-4 pb-3">
          {fixes.map((f) => {
            const done = applied.has(f.fingerprint);
            return (
              <li key={f.fingerprint} className="overflow-hidden rounded-panel border border-line bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <p className={`min-w-0 text-sm font-medium ${done ? "text-faint" : "text-text"}`}>
                    <span className="mr-2 font-mono text-xs text-muted">line {f.line}</span>
                    {f.title}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          promptForFinding(f, filename),
                          "Prompt copied. Paste it into Cursor or Claude Code.",
                        )
                      }
                      className={`${small} border border-line bg-surface text-text hover:bg-surface-2`}
                    >
                      Copy prompt
                    </button>
                    <button
                      type="button"
                      disabled={done}
                      onClick={() => onApply(f)}
                      className={`${small} border border-line bg-surface text-text hover:bg-surface-2`}
                    >
                      {done ? "Applied" : "Apply fix"}
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto border-t border-line font-mono text-xs leading-relaxed">
                  <code className="block whitespace-pre bg-risk-high-soft px-3 py-1 text-risk-high">
                    {`- ${f.quotedCode}`}
                  </code>
                  <code className="block whitespace-pre bg-risk-low-soft px-3 py-1 text-risk-low">
                    {`+ ${f.suggestion}`}
                  </code>
                </pre>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
        <button type="button" onClick={copy} className={`${small} border border-line bg-surface text-text`}>
          Copy corrected code
        </button>
        <button
          type="button"
          onClick={() =>
            copyText(promptForFile(filename, all), "Prompt copied. Paste it into Cursor or Claude Code.")
          }
          className={`${small} border border-line bg-surface text-text`}
        >
          Copy prompt for all
        </button>
        <button
          type="button"
          onClick={download}
          className={`${small} border border-line bg-surface text-text`}
        >
          Download
        </button>
        {applied.size > 0 && (
          <button
            type="button"
            onClick={onRereview}
            className={`${small} border border-line bg-surface text-text`}
          >
            Re-review to update risk
          </button>
        )}
        <span role="status" className="text-xs text-muted">
          {message || note}
        </span>
      </div>
    </div>
  );
}
