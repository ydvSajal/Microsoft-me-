"use client";

import type { TReviewResult } from "@sift/shared";
import { useState } from "react";
import { ReviewCard } from "@/components/review-card";
import { Panel, Skeleton } from "@/components/ui";

type ApiError = { error: { code: string; message: string; fields?: Record<string, string[]> } };
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; fields?: Record<string, string[]> }
  | { kind: "done"; result: TReviewResult };

const input =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent";

export function ReviewForm({ maxLines }: { maxLines: number }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [lines, setLines] = useState(0);

  async function submit(form: FormData) {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/review-file", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sift-passcode": String(form.get("passcode") ?? ""),
        },
        body: JSON.stringify({ filename: form.get("filename"), content: form.get("content") }),
      });
      const body = (await res.json()) as TReviewResult | ApiError;
      if ("error" in body) {
        const message = res.status === 401 ? "That passcode isn't right." : body.error.message;
        setState({ kind: "error", message, fields: body.error.fields });
      } else setState({ kind: "done", result: body });
    } catch {
      setState({ kind: "error", message: "Couldn't reach Sift. Check your connection and try again." });
    }
  }

  const fieldError = (name: string) =>
    state.kind === "error" && state.fields?.[name] ? (
      <p id={`${name}-error`} className="text-xs text-risk-high">
        {state.fields[name].join(" ")}
      </p>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel className="p-4 md:p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault(); // keep the pasted code on screen (a form action would reset the fields)
            void submit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-2">
              <label htmlFor="passcode" className="text-sm font-medium text-text">
                Demo passcode
              </label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                required
                autoComplete="off"
                className={input}
              />
              <p className="text-xs text-muted">Shared with judges at the demo.</p>
            </div>
            <div className="grid content-start gap-2">
              <label htmlFor="filename" className="text-sm font-medium text-text">
                File name
              </label>
              <input
                id="filename"
                name="filename"
                required
                defaultValue="src/checkout.ts"
                aria-describedby="filename-error"
                className={`${input} font-mono`}
              />
              {fieldError("filename")}
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="content" className="text-sm font-medium text-text">
                Code
              </label>
              <span className={`font-mono text-xs ${lines > maxLines ? "text-risk-high" : "text-faint"}`}>
                {lines} / {maxLines} lines
              </span>
            </div>
            <textarea
              id="content"
              name="content"
              required
              rows={18}
              spellCheck={false}
              aria-describedby="content-error"
              onChange={(e) =>
                setLines(e.target.value ? e.target.value.replace(/\r?\n$/, "").split(/\r?\n/).length : 0)
              }
              className={`${input} resize-y font-mono text-xs leading-relaxed`}
            />
            {fieldError("content")}
          </div>
          <button
            type="submit"
            disabled={state.kind === "loading"}
            className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {state.kind === "loading" ? "Reviewing…" : "Review this file"}
          </button>
        </form>
      </Panel>

      <div aria-live="polite">
        {state.kind === "idle" && (
          <Panel className="flex h-full min-h-64 items-center justify-center p-8 text-center">
            <p className="max-w-[40ch] text-sm leading-relaxed text-muted">
              The review shows up here: risk tier, ranked findings, and how many were dropped as unverified.
            </p>
          </Panel>
        )}
        {state.kind === "loading" && (
          <Panel className="grid gap-4 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </Panel>
        )}
        {state.kind === "error" && (
          <Panel className="border-risk-high p-5">
            <p className="text-sm font-medium text-risk-high">{state.message}</p>
          </Panel>
        )}
        {state.kind === "done" && <ReviewCard result={state.result} title="Your file" />}
      </div>
    </div>
  );
}
