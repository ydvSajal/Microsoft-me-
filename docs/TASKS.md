# TASKS — solo backlog

One person, every file. Tickets are in build order. Tick the box in the same PR that completes the ticket.

**Priority:**
- **P0:** required by the problem statement or the demo.
- **P1:** differentiator.
- **P3:** only if all gates are on time.

**Start here:** on your first run, tick anything you've already built, then continue from the first unticked P0.

## Oct 1 — foundation + first demoable thing

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☑ | **T-01** | P0 | Repo bootstrap + CI/CD | `chore/t01-bootstrap` | pnpm workspaces (`apps/*`, `packages/*`), strict `tsconfig.base.json`, Biome, Vitest, root scripts (`format`, `format:check`, `lint`, `typecheck`, `test`, `check:boundaries`); all 5 workflows in `.github/workflows`; `setup-repo.sh` run; a test push to `main` is rejected; first PR shipped via `ship.sh` auto-merges |
| ☑ | **T-02** | P0 | Shared contracts + fixtures | `feat/t02-contracts` | Every schema in TRD §2; 5 fixtures; a test parses each fixture |
| ☑ | **T-03** | P0 | Provider layer | `feat/t03-provider` | `getModel("review" \| "judge")` via the AI SDK; provider and model come from env only; a mock provider for tests |
| ☑ | **T-04** | P0 | Review call + tone rules | `feat/t04-review` | `reviewHunks()` with `generateObject` + `ModelFinding`; prompt follows TRD §5; retries once, then `[]` + error flag; mocked tests incl. malformed output |
| ☑ | **T-05** | P0 | CLI | `feat/t05-cli` | `pnpm sift review <file>` prints findings + summary; `--json` outputs a valid `ReviewResult` (mode `file`). **This is the mentor-round demo if your slot is today.** |

## Oct 2 — PR pipeline end to end (Gate 1)

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☐ | **T-06** | P0 | Demo repo `sift-demo-shop` | *(other repo)* `feat/t06-shop` | ~15-file TS shop: `cart.ts`, `checkout.ts`, `auth.ts`, `api/refund.ts`; `sift.yml` from DEPLOYMENT §4 merged first; **then** protect `main` with 1 required approval (the human-approver proof), leaving "include administrators" off so you can still land setup changes; benchmark PRs stay open and are never merged |
| ☑ | **T-07** | P0 | Diff map | `feat/t07-diff-map` | RIGHT-side added lines per file; renames, deletions, binary files, multi-hunk; ≥6 fixture tests |
| ☐ | **T-08** | P0 | Action skeleton *(code merged; live check pending: demo repo + key)* | `feat/t08-action` | Posts one `COMMENT` review with stub findings on valid lines, pinned to `commit_id`; skips drafts; fork PRs → log and exit 0 |
| ☑ | **T-09** | P0 | Judge + quote check | `feat/t09-judge` | Drops findings whose `quotedCode` isn't in the file; judge re-scores confidence; judge failure keeps the original confidence |
| ☐ | **T-10** | P0 | End-to-end wiring (**Gate 1**) *(code merged; live check pending: demo repo + key)* | `feat/t10-e2e` | Real findings → grounding against the diff map → posted; off-diff findings go only to the summary; 0 GitHub 422s on 5 demo PRs. **Then set `SIFT_SELF_REVIEW=true`** |

## Oct 3 — ranking, dedupe, risk (Gate 2)

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☑ | **T-11** | P0 | Summary + inline rendering | `feat/t11-render` | `renderSummary` / `renderInline` produce GitHub markdown; friendly copy; severity badges; nits in `<details>`; hidden `sift:fp` / `sift:patch` markers; snapshot tests |
| ☑ | **T-12** | P0 | Rank + budget | `feat/t12-rank` | Score = weight × confidence; ≤7 inline; nits never inline; ordering tests |
| ☑ | **T-13** | P0 | Dedupe | `feat/t13-dedupe` | Fingerprints + grouping per TRD §4.2; N files → 1 comment with "also in"; re-push posts 0 repeats |
| ☑ | **T-14** | P0 | Risk tier + labels (**Gate 2**) | `feat/t14-risk` | Tier per TRD §4.4; exactly one `sift:risk-*` label, stale ones removed |
| ☑ | **T-28** | P1 | Entry-point seams (App-ready) | `refactor/t28-seams` | `runPrReview` reads files only through an injected `readFile(path)` dep (default: the workspace reader) and reads no env or Action-only state; tests use an in-memory reader; zero behaviour change. Keeps the GitHub App (T-29+) a new entry point, not a rewrite. See ARCHITECTURE §7 |

## Oct 4 — differentiators + benchmark data

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☐ | **T-15** | P1 | Stack awareness | `feat/t15-stack` | Base-ref chain detection; unchanged layer (patch-id) → 0 LLM calls; stack-scoped fingerprints; stack risk map in the summary; flag `stack` |
| ☑ | **T-16** | P1 | Impact analysis | `feat/t16-impact` | ts-morph references to changed exports outside the diff → LLM context + summary list; flag `impact` |
| ☐ | **T-17** | P0 | Benchmark PRs (10) | `test/t17-bench-set` | On `sift-demo-shop`: 5 seeded-bug PRs, 3 clean refactors (expect 0 comments), 1 nit-heavy PR, 1 three-layer stack with a cross-layer bug; `benchmark/labels.json` merged **before** any run |

## Oct 5 — web, feedback, numbers (Gate 3: freeze at EOD)

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☐ | **T-18** | P0 | DB + ingest API + health | `feat/t18-ingest` | Prisma schema (TRD §3) + migration; ingest routes, `/config`, `GET /api/health`; Bearer auth, zod, 1 MB cap; deployed on Vercel; `deploy-smoke` green |
| ☐ | **T-19** | P0 | Paste page + dashboard | `feat/t19-dashboard` | `/review` (passcode) → findings + summary; `/repos/[owner]/[name]`: PRs with risk + precision by category; `/prs/[id]`: findings with placement and outcome; empty/error states |
| ☐ | **T-20** | P1 | Ingest client + feedback | `feat/t20-feedback` | Action posts review-started + result; collects outcomes per TRD §4.6; API down → review still posts; flag `feedback` |
| ☐ | **T-21** | P0 | Benchmark runner + results | `feat/t21-bench` | `pnpm bench`: Sift vs naive single-pass LLM (+ Copilot if available), 3 runs each; `benchmark/results.md` with the PRD §6 metrics (medians) + method note |

## Oct 6 — demo-ready

| ✓ | ID | Pri | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|---|
| ☐ | **T-22** | P0 | Demo runbook + backup video | `docs/t22-demo` | Full dry run on the phone hotspot; `docs/SUPPORT.md` §3 matches reality; backup video recorded and stored offline; Day-1 deck updated with the benchmark table |

## P3 — only if every gate was met on time

Each is independent, behind a flag, and cut without discussion if time is short.

| ✓ | ID | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|
| ☐ | **T-23** | Auto-mute | `feat/t23-auto-mute` | LOW/NIT category with ≥10 samples and <30% precision is muted; shown on the dashboard |
| ☐ | **T-24** | Convention mining | `feat/t24-conventions` | 5 AST patterns; ≥80% of ≥20 samples; written to `.github/copilot-instructions.md`; flag `conventions` |
| ☐ | **T-25** | Telegram bot | `feat/t25-telegram` | grammY webhook with secret check; `/start <login> <token>`; pings only for high risk, critical, or waiting > `WAIT_HOURS` |
| ☐ | **T-26** | Buddy mood + route | `feat/t26-buddy-route` | `computeBuddyState()` per TRD §6 with tests; `GET /api/buddy`, `POST /api/buddy/ack` |
| ☐ | **T-27** | Buddy firmware | `feat/t27-buddy-fw` | ESP32-S3 renders 7 moods at ~30 fps (network core 0, render core 1); button ack/snooze; long-press demo mode; `firmware-build` green |

## Post-hackathon — GitHub App (after Oct 8)

The second entry point from ARCHITECTURE §7: users install Sift once and every repo they select is reviewed automatically, with no workflow file or secrets. **Do not start before the finale.** The Action stays the demo path. Spec: TRD §10.

| ✓ | ID | Ticket | Branch | Acceptance criteria |
|---|---|---|---|---|
| ☐ | **T-29** | App registration | `chore/t29-github-app` | App created from a committed manifest (permissions + events per TRD §10); private key + webhook secret in Vercel env only; DEPLOYMENT §11 documents setup |
| ☐ | **T-30** | Webhook endpoint | `feat/t30-webhook` | `POST /api/github/webhook`: `X-Hub-Signature-256` verified in constant time, zod-validated, 1 MB cap, idempotent on `X-GitHub-Delivery`; unknown events → 204 |
| ☐ | **T-31** | Installations + auto-onboarding | `feat/t31-installations` | Prisma `Installation` + `Repo.installationId`; `installation` and `installation_repositories` events add/remove repos and create the `sift:risk-*` labels; a newly created or newly granted repo appears on the dashboard with no user action |
| ☐ | **T-32** | Installation tokens + API file reader | `feat/t32-app-client` | App JWT → short-lived installation token per job; `createGitHub()` accepts it; `readFile` via the contents API at `head.sha`; tokens never logged or stored |
| ☐ | **T-33** | Review queue + worker | `feat/t33-review-queue` | Webhook enqueues a job and returns fast; a worker runs `runPrReview`; retries with backoff; per-installation concurrency and model-budget limits; a job failure never double-posts |
| ☐ | **T-34** | Sign in with GitHub | `feat/t34-github-login` | Dashboard login via the App's OAuth; each user sees only repos from installations they can access; replaces the demo passcode for dashboard pages |
| ☐ | **T-35** | Action and App coexistence | `feat/t35-coexist` | A repo with the App installed and the Action workflow gets **one** review per push: the Action detects the App (or a repo variable) and exits 0; documented migration from Action to App |

## Cut order if a gate slips

1. All P3 (T-23 … T-27)
2. T-28 seams (the App is post-hackathon anyway)
3. T-20 feedback: keep the dashboard on review data only
4. T-16 impact analysis
5. T-15 stack awareness

**Never cut:** T-05 or T-19's paste page (single-file review), T-07/T-10 (diff-scoped), T-06 (human approver), T-12/T-13 (rank + dedupe), T-11 (summary), T-17/T-21 (benchmark; minimum 6 PRs).
