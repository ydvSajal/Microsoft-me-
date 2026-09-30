# PRD — Sift (solo build)

**One line:** Sift is an AI code reviewer that helps overloaded senior engineers review only what matters. It posts friendly, ranked, diff-scoped comments, and a human always approves.

**Built for:** Microsoft Innovate 2026 · Problem 8: The Review-Queue Bottleneck

## 1. Problem

In a startup, two senior engineers review every pull request, and that queue now sets the release pace.

- Large diffs get skimmed, and costly bugs slip through. Code outside the diff that a change breaks is rarely checked.
- AI reviewers were meant to help, but they add noise:
  - In an independent audit, only ~35% of AI review comments were genuine improvements, and ~36% were nitpicks or useless.
  - Critical bugs and style nits look identical.
  - The same nit repeats across files, pushes and, now, stacked-PR layers.
  - No tool shows how often its comments were actually acted on.

**Cost of not solving it:** slower releases, reviewer burnout, and teams that learn to ignore AI review entirely.

## 2. Users

| Persona | Need |
|---|---|
| **Senior reviewer** (primary) | Know which PRs need them first, where to look, and read only comments worth their time |
| **PR author** (junior/mid) | Fast, specific, friendly feedback before a human looks |
| **Engineering lead** | Proof the bot helps: its precision in *this* repo |

## 3. Goals

1. **Trustworthy comments:** ≥60% of posted comments are correct and actionable (audit baseline: 35%).
2. **Low noise:** ≤7 inline comments per PR; 0 comments off the diff; 0 duplicate comments across files, pushes or stack rebases.
3. **Faster triage:** every PR gets a risk tier, so reviewers can order the queue in GitHub.
4. **Full coverage of the spec:** single-file review, friendly feedback on bugs, names and style, an overall summary, PR comments scoped to the diff, a human approver, severity ranking, duplicate suppression.

## 4. Non-goals

| Non-goal | Why |
|---|---|
| Approving, blocking or auto-merging PRs | The spec requires AI comments to be advisory; a human is always the approver |
| Auto-fixing code | Out of scope; increases risk and review load |
| Languages other than TypeScript/JavaScript | Impact analysis needs a real type checker (ts-morph); depth over breadth for v1 |
| GitLab, Azure DevOps, Bitbucket | GitHub only for v1 |
| Mining past review history | Needs long history the demo repo won't have |
| Roast-mode humour in PR comments | Conflicts with "friendly"; roasts stay opt-in on personal surfaces only |

## 5. User stories and requirements

### P0 — must have (the demo fails without these)

| ID | Story | Acceptance criteria |
|---|---|---|
| P0-1 | As a PR author, I want to review a single file so that I get feedback without opening a PR | Given a `.ts`/`.js` file, when I run `sift review <file>` or paste it on `/review`, then I see findings (category, severity, line, fix) and a summary within 60 s |
| P0-2 | As a senior reviewer, I want comments only on changed lines so that I'm not distracted by untouched code | 100% of inline comments land on added/modified lines of the reviewed commit; off-diff findings appear only in the summary |
| P0-3 | As a senior reviewer, I want findings ranked by severity so that I see the critical ones first | Inline comments ordered Critical → Low; ≤7 inline; nits collapsed in the summary |
| P0-4 | As a PR author, I don't want the same nit repeated so that the review stays readable | Same issue in N files = 1 comment with an "also in" list; re-push posts no already-posted issue |
| P0-5 | As an engineering lead, I want a human to stay the required approver so that AI never merges code | Sift posts `COMMENT` reviews only; the demo repo's branch protection requires 1 human approval |
| P0-6 | As a PR author, I want a friendly overall summary so that I understand the review at a glance | Summary: what changed (≤2 sentences), risk tier, top issues, collapsed nits, affected code outside the diff |
| P0-7 | As a senior reviewer, I want a risk label on each PR so that I can triage the queue | Exactly one `sift:risk-high/medium/low` label per PR, updated on each push |
| P0-8 | As judges, we want reproducible proof so that claims are credible | Benchmark of 10 PRs vs baselines, 3 runs each, medians published with labels committed beforehand |

### P1 — should have (the differentiators)

| ID | Story | Acceptance criteria |
|---|---|---|
| P1-1 | As a reviewer, I want to know what a change breaks outside the diff | Callers of changed exported functions are listed in the summary and given to the model as context |
| P1-2 | As an engineering lead, I want to see Sift's precision per repo | Dashboard shows accepted vs dismissed findings per category |
| P1-3 | As a team using stacked PRs, we don't want repeat reviews on rebase | Unchanged layer → 0 LLM calls, 0 new comments; stack risk map in each summary |

### P3 — only if ahead of schedule (solo build)

Built only if all three gates in `docs/TIMELINE.md` are met on time. Each is independent and behind a feature flag.

| ID | Story | Acceptance criteria |
|---|---|---|
| P3-1 | As a team, we want noisy categories to quiet down automatically | A LOW/NIT category with ≥10 samples and <30% precision is auto-muted; CRITICAL/HIGH/security never |
| P3-2 | As a reviewer, I want comments that match our conventions | Conventions mined with evidence counts; exported to `.github/copilot-instructions.md` |
| P3-3 | As a senior reviewer, I want a ping only when it matters | Telegram message on high risk, a critical finding, or a PR waiting >N hours; nothing else |
| P3-4 | As a reviewer, I want an ambient signal on my desk | ESP32 buddy shows 7 moods from queue state; button ack/snooze |

### Future (design for it, don't build it)

GitHub App distribution · more languages · split-into-stack suggestions · org-wide dashboard · SSO.

## 6. Success metrics (measured by the benchmark)

| Metric | Target | Baseline to beat |
|---|---|---|
| Precision (correct + actionable / posted) | ≥ 60% | Naive single-pass LLM; audit's 35% |
| Seeded-bug recall | Report vs baselines | Naive LLM, Copilot/CodeRabbit |
| Inline comments per PR (median) | ≤ 7 | — |
| Comments off the diff | 0 | — |
| Duplicate comments | 0 | — |
| Comments on clean refactors | ~0 | — |
| Re-posts after stack rebase | 0 | Naive LLM |
| LLM calls on unchanged layers | 0 | Naive LLM |
| Review latency (PR ≤ 20 files) | ≤ 90 s | — |

Method: `benchmark/labels.json` is committed before any run; every reviewer runs 3× per PR; we report medians.

## 7. Open questions

| Question | Resolve by | Blocking? |
|---|---|---|
| Is pre-building allowed before Oct 7? Ask at the mentor round. | Oct 1 | Yes |
| Model access: Azure OpenAI credits, or which free model? | Oct 1 (T-03) | Yes |
| Copilot code review available as a baseline? Otherwise the naive single-pass LLM is the only baseline | Oct 4 | No |
| Stacked PRs enabled on the demo account? Otherwise manual stacks | Oct 4 (T-15) | No |

## 8. Timeline

See `docs/TIMELINE.md`. The hard deadline is a complete demo by the end of **Oct 7** (top-20 cut).
