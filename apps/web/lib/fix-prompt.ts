// Paste-ready prompts that hand Sift's findings to an AI coding agent (Cursor, Claude Code, ChatGPT).
// Self-contained on purpose: the reader of the prompt never sees Sift's page.
import type { TFinding } from "@sift/shared";

const FENCE = "```";

const describe = (f: TFinding, filename: string) =>
  [
    `File: ${filename}`,
    `Line: ${f.line}`,
    `Severity: ${f.severity}`,
    `Category: ${f.category}`,
    `Problem: ${f.title}. ${f.body}`.trim(),
    `Code:\n${FENCE}\n${f.quotedCode}\n${FENCE}`,
    ...(f.suggestion ? [`Suggested fix:\n${FENCE}\n${f.suggestion}\n${FENCE}`] : []),
  ].join("\n");

const ASK = "If anything is ambiguous, ask before editing. Change only what is needed.";

export function promptForFinding(f: TFinding, filename: string): string {
  return [
    "A code reviewer flagged an issue in my code. Fix it in this codebase.",
    describe(f, filename),
    f.suggestion ? `Apply the suggested fix, adjusting it to the surrounding code. ${ASK}` : ASK,
  ].join("\n\n");
}

export function promptForFile(filename: string, findings: readonly TFinding[]): string {
  if (findings.length === 0) return `A code reviewer found no issues in ${filename}. Nothing to change.`;
  const blocks = findings.map((f, i) => `### Issue ${i + 1} of ${findings.length}\n${describe(f, filename)}`);
  return [
    `A code reviewer flagged ${findings.length} ${findings.length === 1 ? "issue" : "issues"} in ${filename}. Fix them in this codebase, most important first.`,
    ...blocks,
    `Apply the fixes, adjusting suggested code to the surrounding code. ${ASK}`,
  ].join("\n\n");
}
