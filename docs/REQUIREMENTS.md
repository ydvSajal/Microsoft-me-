# REQUIREMENTS

Testable requirements with IDs, traced to the problem statement and to tickets. The PRD says *why*; this file says *exactly what must be true*.

## 1. Traceability to the problem statement

| Problem statement line | Requirement IDs | Tickets |
|---|---|---|
| "A tool that reviews a code file" | FR-01, FR-02 | T-04, T-05, T-19 |
| "Friendly, specific feedback (possible bugs, unclear names, style)" | FR-03, FR-04 | T-04, T-09 |
| "Plus an overall summary" | FR-05 | T-11, T-12 |
| "Copilot or a free AI model" | FR-06, FR-20 | T-03, T-24 (P3) |
| "Optionally a GitHub Action to run it automatically" | FR-07 | T-08 |
| "Post comments on the actual pull request, scoped to the diff" | FR-08, FR-09 | T-07, T-10 |
| "Keep a human as the required approver — AI comments are advisory" | FR-10 | T-08, T-06 |
| "Rank findings by severity and suppress duplicate nitpicks" | FR-11 … FR-14 | T-12, T-13, T-15 |
| Scenario: "two senior engineers review every PR" | FR-15 … FR-19, FR-21, FR-22 | T-14, T-16, T-18 … T-20; FR-21/22 are P3 (T-25, T-26) |

## 2. Functional requirements

### Review core
| ID | Requirement |
|---|---|
| FR-01 | The CLI `sift review <path>` reviews one TS/JS file and prints findings + summary; `--json` outputs a valid `ReviewResult` with `mode: "file"`. |
| FR-02 | The web page `/review` accepts a pasted file (≤ 400 lines), is protected by a passcode, and shows the same result as the CLI. |
| FR-03 | Every finding has: `file`, `line`, `severity`, `category`, `ruleKey`, `title`, `body`, `quotedCode`, `confidence`, optional `suggestion`. It is validated by the zod `Finding` schema. |
| FR-04 | Categories cover bugs, security, breaking changes, performance, error handling, naming, style, conventions, tests and docs. Wording follows the tone rules (TRD §5). |
| FR-05 | Every review produces a summary: what changed, risk tier, top issues, collapsed nits, affected code outside the diff, skipped files (if any). |
| FR-06 | The model provider and model names are configuration, never code. Changing provider needs no code change in `packages/core`. |

### Pull request integration
| ID | Requirement |
|---|---|
| FR-07 | The Action runs on `pull_request` (opened, synchronize, reopened, ready_for_review) and skips drafts. |
| FR-08 | Inline comments are posted only on RIGHT-side added lines present in the diff map for the reviewed `commit_id`. |
| FR-09 | Findings that fail grounding (quote not in file, or line not in the diff map) are never posted inline; they move to the summary or are dropped. |
| FR-10 | Sift submits reviews with event `COMMENT` only. It never uses `APPROVE` or `REQUEST_CHANGES`. |
| FR-11 | Findings are ranked by `SEVERITY_WEIGHT[severity] × confidence`. |
| FR-12 | At most `MAX_INLINE = 7` inline comments; `nit` severity is never inline. |
| FR-13 | Findings with the same fingerprint, or the same `category + ruleKey` for low/nit, become one comment listing the other locations. |
| FR-14 | A fingerprint already posted on the PR (or anywhere in its stack) is never posted again. |
| FR-15 | Each PR carries exactly one risk label: `sift:risk-high`, `sift:risk-medium` or `sift:risk-low`. |
| FR-16 | Stack layers whose own diff is unchanged since the last review are skipped with zero LLM calls. |
| FR-17 | With flag `impact`: callers of changed exported symbols outside the diff are listed in the summary. |

### Feedback, dashboard, notifications
| ID | Requirement |
|---|---|
| FR-18 | Feedback outcomes are recorded per finding: `accepted` (line changed later, 👍, `/sift accept`) or `dismissed` (`/sift ignore`, 👎, thread resolved without change). |
| FR-19 | The dashboard shows precision per category per repo and the list of muted categories. |
| FR-20 | With flag `conventions`: mined rules are written to `.github/copilot-instructions.md` with evidence counts. |
| FR-21 | Telegram sends a message only for high risk, a critical finding, or a PR waiting > `WAIT_HOURS`. |
| FR-22 | `GET /api/buddy` returns a `BuddyState`; `rev` increments only on a new event. |

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Latency | A PR with ≤ 20 changed files is reviewed in ≤ 90 s (p50). Single-file review ≤ 60 s. |
| NFR-02 | Cost | ≤ `MAX_FILES = 25` files reviewed per PR; lockfiles, generated, minified and binary files are skipped; LLM concurrency ≤ 4. |
| NFR-03 | Reliability | An LLM or schema failure on one file never fails the whole review; the file is listed as skipped. Web API down → the review still posts. |
| NFR-04 | Security | The Action uses `pull_request` (never `pull_request_target`); token permissions are `contents: read`, `pull-requests: write`, `issues: write` only. |
| NFR-05 | Security | PR content is untrusted input. Prompt injection can at most produce a bad comment, because Sift cannot approve, merge or run code. |
| NFR-06 | Security | Secrets live only in env / GitHub secrets / Vercel env. None in code, logs or client bundles. `.env*` is gitignored. |
| NFR-07 | Security | All API routes validate input with zod, cap bodies at 1 MB, and authenticate (Bearer, device token, Telegram secret, passcode). |
| NFR-08 | Quality | TypeScript strict; no unexplained `any`; pure logic has unit tests; CI has no network access to LLMs. |
| NFR-09 | Maintainability | Modules stay within their package boundaries (ARCHITECTURE §3); cross-package types come only from `@sift/shared`. |
| NFR-10 | Usability | The dashboard works on mobile widths; empty and error states are present on every page. |

## 4. Constraints

- TypeScript/JavaScript repositories only.
- GitHub only.
- Advisory only: no approve, block or merge.
- Demo must run on a phone hotspot: campus Wi-Fi is not relied on.

## 5. Environment prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 22 LTS | `node -v` |
| pnpm | 11.x (pinned via `packageManager`) | `pnpm -v` |
| Git | ≥ 2.40 | `git --version` |
| GitHub CLI | latest | `gh auth status` |
| Editor | VS Code + Biome extension | — |
| PlatformIO (buddy only, P3) | latest | `pio --version` |

**Accounts:** GitHub (admin on `sift` and `sift-demo-shop`), Azure OpenAI or the chosen free model, Vercel, Neon or Supabase (Postgres), Telegram (BotFather) for T-25 (P3).
