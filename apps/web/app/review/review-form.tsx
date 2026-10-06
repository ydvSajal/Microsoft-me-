"use client";

import type { TFinding, TReviewResult } from "@sift/shared";
import { useEffect, useRef, useState } from "react";
import { FixPanel, RiskButton } from "@/components/fix-panel";
import { ReviewCard } from "@/components/review-card";
import { Panel, Skeleton } from "@/components/ui";
import { UPLOAD_EXTENSIONS, UPLOAD_MAX_BYTES } from "@/lib/config";
import { applyAll, applySuggestion, fixable } from "@/lib/fixes";
import { SHOWCASE, type ShowcaseExample } from "@/lib/showcase";

type ApiError = { error: { code: string; message: string; fields?: Record<string, string[]> } };
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; fields?: Record<string, string[]> }
  | { kind: "done"; result: TReviewResult };

const input =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent";

const countLines = (s: string) => (s ? s.replace(/\r?\n$/, "").split(/\r?\n/).length : 0);

export function ReviewForm({ maxLines }: { maxLines: number }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [filename, setFilename] = useState("src/checkout.ts");
  const [content, setContent] = useState("");
  const [uploadNote, setUploadNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fixesOpen, setFixesOpen] = useState(false);
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set());
  const [fixMessage, setFixMessage] = useState("");
  const [example, setExample] = useState<ShowcaseExample | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lines = countLines(content);

  // Tell the buddy (components/buddy.tsx) how this file went.
  useEffect(() => {
    if (state.kind !== "done") return;
    const detail = [...state.result.inline, ...state.result.summarized];
    window.dispatchEvent(new CustomEvent("sift:review", { detail }));
  }, [state]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!UPLOAD_EXTENSIONS.test(file.name))
      return setUploadNote({ text: `${file.name} isn't a .ts, .tsx, .js or .jsx file.`, bad: true });
    if (file.size > UPLOAD_MAX_BYTES)
      return setUploadNote({
        text: `${file.name} is too large. Sift reviews up to ${maxLines} lines.`,
        bad: true,
      });
    try {
      const text = await file.text();
      const n = countLines(text);
      setFilename(file.name);
      setContent(text);
      setUploadNote(
        n > maxLines
          ? { text: `${file.name} has ${n} lines. Trim it to ${maxLines} or fewer.`, bad: true }
          : { text: `Loaded ${file.name} (${n} lines).`, bad: false },
      );
    } catch {
      setUploadNote({ text: "Couldn't read that file.", bad: true });
    }
  }

  function showExample(e: ShowcaseExample) {
    setExample(e);
    setFilename(e.filename);
    setContent(e.content);
    setUploadNote(null);
    setApplied(new Set());
    setFixesOpen(false);
    setFixMessage("");
    setState({ kind: "done", result: e.result });
  }

  async function submit(form: FormData) {
    setExample(null);
    setState({ kind: "loading" });
    setApplied(new Set());
    setFixesOpen(false);
    setFixMessage("");
    try {
      const res = await fetch("/api/review-file", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sift-passcode": String(form.get("passcode") ?? ""),
        },
        body: JSON.stringify({ filename, content }),
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

  function applyOne(f: TFinding) {
    const res = applySuggestion(content, f.quotedCode, f.suggestion ?? "");
    if (!res.ok) {
      setFixMessage(
        res.reason === "ambiguous"
          ? `Line ${f.line}: that code appears more than once, so nothing was changed.`
          : `Line ${f.line} has changed since the review, so nothing was changed. Review again.`,
      );
      return;
    }
    setContent(res.content);
    setApplied((prev) => new Set(prev).add(f.fingerprint));
    setFixMessage("");
  }

  function applyEvery(fixes: TFinding[]) {
    const out = applyAll(
      content,
      fixes.filter((f) => !applied.has(f.fingerprint)),
    );
    setContent(out.content);
    setApplied((prev) => new Set([...prev, ...out.applied]));
    setFixMessage(out.skipped.length ? `${out.skipped.length} fix(es) skipped: the code has changed.` : "");
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
          ref={formRef}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault(); // keep the code on screen (a form action would reset the fields)
            void submit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-2">
            <p className="text-sm font-medium text-text">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {SHOWCASE.map((e) => (
                <button
                  key={e.slug}
                  type="button"
                  title={e.blurb}
                  onClick={() => showExample(e)}
                  className={`inline-flex h-8 items-center rounded-control border px-3 text-xs font-medium transition active:scale-[0.98] ${
                    example?.slug === e.slug
                      ? "border-accent bg-accent-soft text-text"
                      : "border-line bg-surface text-text hover:border-accent"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {example
                ? `${example.blurb} Recorded review, shown instantly.`
                : "Recorded reviews. They load instantly, with no passcode."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void loadFile(e.dataTransfer.files[0]);
            }}
            className={`grid gap-1 rounded-panel border border-dashed px-4 py-5 text-center text-sm transition ${
              dragging ? "border-accent bg-accent-soft" : "border-line bg-bg hover:border-accent"
            }`}
          >
            <span className="text-text">
              <span className="font-medium">Drop a file here</span> or{" "}
              <span className="font-medium text-accent underline underline-offset-2">choose a file</span>
            </span>
            <span className={`text-xs ${uploadNote?.bad ? "text-risk-high" : "text-muted"}`}>
              {uploadNote?.text ?? "The file is read in your browser and sent only when you press Review."}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ts,.tsx,.mts,.cts,.js,.jsx,.mjs,.cjs"
            hidden
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

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
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-describedby="content-error"
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
              The review shows up here: risk tier, ranked findings, and the fixes Sift suggests.
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
        {state.kind === "done" &&
          (() => {
            const fixes = fixable(state.result);
            const pending = fixes.filter((f) => !applied.has(f.fingerprint)).length;
            return (
              <ReviewCard
                result={state.result}
                title={filename}
                riskSlot={
                  <RiskButton
                    tier={state.result.riskTier}
                    open={fixesOpen}
                    pending={pending}
                    onToggle={() => setFixesOpen((o) => !o)}
                  />
                }
                belowHeader={
                  fixesOpen && (
                    <FixPanel
                      fixes={fixes}
                      all={[...state.result.inline, ...state.result.summarized]}
                      applied={applied}
                      filename={filename}
                      content={content}
                      message={fixMessage}
                      onApply={applyOne}
                      onApplyAll={() => applyEvery(fixes)}
                      onRereview={() => formRef.current?.requestSubmit()}
                    />
                  )
                }
              />
            );
          })()}
      </div>
    </div>
  );
}
