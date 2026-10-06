# SUPPORT — troubleshooting, demo runbook, break-glass

**The 30-minute rule (solo version):** stuck for 30 minutes on one error → stop, write down the exact error and what you tried, and either cut the scope or switch tickets and come back fresh.

## 1. Troubleshooting

### GitHub / Action
| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow didn't trigger on an upper stacked PR | Branch filter on `pull_request` | Remove `branches:` from `sift.yml` |
| Workflow didn't trigger at all | PR is a draft, or the workflow file isn't on the default branch | Mark ready for review; merge `sift.yml` to `main` first |
| `403 Resource not accessible by integration` | Missing `pull-requests: write` / `issues: write`, or a fork PR | Check the `permissions:` block; fork PRs are read-only by design |
| `422` saying the line must be part of the diff | Diff-map bug, or a finding bypassed grounding | Log the finding and the diff map; add the patch as a fixture test; fix T-07/T-10 |
| Same comment posted again after a push | Markers missing or not read | Check `<!-- sift:fp=… -->` is in the posted body (T-11) and that core lists **all** review comments (paginate) |
| Stack layer re-reviewed after rebase | Shallow checkout | `fetch-depth: 0` in checkout |
| Review takes > 3 min | Too many files, or no concurrency | Check `MAX_FILES`, `LLM_CONCURRENCY`, skip patterns |
| Merge blocked | A required check is red, or a conversation is unresolved | Read the merge box; fix and re-ship. Don't bypass. |
| `pr-hygiene` failing | Title, branch or ticket ID format | See CONTRIBUTING §2; editing the PR title re-runs the check |

### CI/CD
| Symptom | Likely cause | Fix |
|---|---|---|
| Auto-merge never fires | Auto-merge disabled on the repo, or a required check name doesn't match the job name | Re-run `setup-repo.sh`; job names must be exactly `ci-checks` and `pr-hygiene` |
| `ship.sh` fails at `gh pr merge --auto` | Repo setting "Allow auto-merge" off | `gh api -X PATCH repos/<you>/sift -F allow_auto_merge=true` |
| `check:boundaries` fails | A package imports something it must not | Move the code to the right package, or pass data through `@sift/shared` types |
| `deploy-smoke` gets 401 | Vercel Deployment Protection on previews | Add the `VERCEL_AUTOMATION_BYPASS_SECRET` repo secret, or disable preview protection |
| `deploy-smoke` never runs | Vercel isn't posting deployment statuses | Vercel → Settings → Git: GitHub integration connected; check the repo's Deployments tab |
| `deploy-smoke` says `db: false` | Wrong `DATABASE_URL` in Vercel, or migration failed | Check the Vercel build log for `prisma migrate deploy` |
| Self-review doesn't run | `SIFT_SELF_REVIEW` isn't `true`, or model secrets are missing in the **sift** repo | DEPLOYMENT §3 |
| `main` went red after a merge | Two PRs were fine alone but conflict together (checks are non-strict) | The next PR is the fix; nothing else merges first |

### AI layer
| Symptom | Likely cause | Fix |
|---|---|---|
| Schema validation errors | Model returned extra/missing fields | Retry is built in; if frequent, tighten the prompt with an example, lower the temperature, check the model supports structured output |
| `401` / `404` from the provider | Wrong resource name, key or deployment name | Verify the key for the selected `SIFT_AI_PROVIDER` and that `SIFT_MODEL` is a model id that provider serves (e.g. `gemini-2.5-flash`) |
| Rate limited (`429`) | Burst of parallel calls | Lower `LLM_CONCURRENCY` to 2; the retry uses backoff |
| Findings feel generic or harsh | Tone rules not applied | Check `prompts/review.md` includes TRD §5; add 2 good + 1 bad example |
| Findings on wrong lines | Hunk line numbers not passed to the model | Ensure each hunk line is prefixed with its RIGHT-side line number |

### Web / DB / Telegram (P3)
| Symptom | Likely cause | Fix |
|---|---|---|
| Vercel build fails on Prisma | Client not generated / wrong root dir | Root Directory `apps/web`; add `"postinstall": "prisma generate"` |
| Migrations hang on Neon/Supabase | Using the pooled URL for migrations | `DIRECT_URL` for migrate, `DATABASE_URL` pooled for runtime |
| Ingest returns `401` | Secret mismatch between the Action and Vercel | Re-set `SIFT_INGEST_SECRET` in both; redeploy Vercel |
| Ingest returns `400` | Contract drift | Both sides must be on the latest `@sift/shared`; check the zod error fields |
| Telegram silent | Webhook not set, or secret mismatch | Run `getWebhookInfo` (DEPLOYMENT §7); check `last_error_message` |

### Buddy (P3)
| Symptom | Likely cause | Fix |
|---|---|---|
| Won't join Wi-Fi | Campus network (captive portal / enterprise auth) | Use the phone hotspot, 2.4 GHz band |
| Screen blank | Wrong pins/driver config | Test the LovyanGFX solid-fill example first; check the SPI pins in the config |
| Eyes stutter every few seconds | HTTP call on the render core | The network task must be pinned to core 0, rendering to core 1 |
| Always "sleepy" | Device token wrong or user has no pending PRs | Serial log shows the HTTP status; check the `Device` row is linked to the right user |
| Serial monitor silent | USB CDC on boot disabled | Build flag `-DARDUINO_USB_CDC_ON_BOOT=1` |

## 2. Demo-day setup (Oct 7–8)

Bring:
- 2 laptops (primary + backup), both logged in to GitHub and Vercel;
- phone hotspot + a charged power bank;
- (P3) buddy + USB cable;
- the backup video on **both** laptops, offline;
- the benchmark table as a static slide.

**T-60 min:**
- Run the DEPLOYMENT §10 checklist on the hotspot.
- Open these tabs:
  - the prepared demo PR branch (not yet opened as a PR)
  - the dashboard
  - (P3) the Telegram chat
  - the benchmark slide
- Prewarm with one throwaway PR, so the pnpm cache is warm and the first run is fast.

## 3. Demo script (~3 min)

Everything runs on `ydvSajal/sift-demo-shop` (12 open PRs) and https://microsoft-me.vercel.app. Hero PR: **#2** `refactor(refund): simplify the refund amount check`. Sift flags a High bug (refunds ignore `refundedCents`) with a concrete fix. If you need a fresh run, push a trivial commit to `bug/refund-ignores-prior`.

| Time | Action | What the audience sees |
|---|---|---|
| 0:00 | Problem line: "~35% of AI review comments are useful. Reviewers stopped reading them." | Slide |
| 0:20 | Open PR #2 on the demo shop; push a trivial commit to re-trigger the review | GitHub, the `Sift review` check running |
| 0:40-1:30 | The review lands (~1 min) | `sift:risk-high` label; one ranked inline comment at `src/api/refund.ts:18` with a suggested fix; summary lists anything off the diff |
| 1:30 | Open stack PRs #10-#12, then re-push without changes | Stack layers reviewed once; the re-push posts **nothing** |
| 2:00 | Web: `/review` → drop a `.ts` file → click the risk badge → **Apply all** | Before/after fixes applied to the file in the browser |
| 2:15 | Web: `/connect` → Select all → Queue | Repos listed, open PRs queued (needs `SIFT_GITHUB_TOKEN`; skip this row if it isn't set) |
| 2:30 | Benchmark slide (`benchmark/results.md`): precision 67% vs naive 33%, 0 off-diff, 0 re-posts | Sift vs naive on the same model |
| 2:50 | Close: "Sift only comments; humans approve. It shows you its own precision." | - |

Known limits (say them before a judge does): seeded-bug recall is 67%; one clean refactor (#7) gets `risk-high`; jobs queued on `/connect` stay Queued until the worker (T-33) exists.

**If something fails live:**
- Review slow (> 90 s) → keep talking over the stack slide, then return.
- Review fails → switch to the backup video at the same timestamp. Don't debug on stage.
- Wi-Fi dead → backup video (and buddy demo mode, if built).

## 4. Break-glass (demo days only)

Use it only if a demo-critical fix must land on Oct 7–8 and CI itself is unusable (GitHub outage, runner queue stuck). A failing check is **not** a reason: fix the code.

```bash
REPO=<you>/sift
gh api -X DELETE "repos/$REPO/branches/main/protection/enforce_admins"   # admins may bypass
gh pr merge <branch> --squash --admin                                     # still via a PR
gh api -X POST "repos/$REPO/branches/main/protection/enforce_admins"     # restore immediately
```

Write down what was merged, and re-run CI on `main` once GitHub recovers.

## 5. Judge FAQ (prep answers)

| Question | Answer |
|---|---|
| How is this different from Copilot code review? | Copilot comments; Sift triages. Risk labels, a hard comment budget, dedupe across pushes and stacks, off-diff impact, and a published precision number. We also export conventions to Copilot's own instructions file, so the two work together. |
| Why a GitHub Action and not an App? | The Action needs no server and was the safest thing to demo. The pipeline is shared, so the GitHub App (one-click install, every repo auto-onboarded) is a new entry point, not a rewrite. It's next on the roadmap. |
| What if the AI is wrong? | Comments are advisory; a human approves. Wrong categories get dismissed, and low-severity categories with low precision auto-mute. Critical and security never mute. |
| Prompt injection in a PR? | PR content is treated as data; the token can only comment. The worst case is one bad comment. |
| How do you know it works? | 10 labelled PRs, labels committed before any run, 3 runs per reviewer, medians. The benchmark is reproducible with `pnpm bench`. |
| (If built) Why a hardware buddy? | The bottleneck is reviewer attention. The buddy is an ambient signal that a PR needs you, without another notification. |
| Cost? | ≤ 25 files per PR, skip patterns, one judge call per PR, and unchanged stack layers cost zero calls. |
| How did you build this in a week? | Contracts first, small PRs, CI + auto-merge on every change, and Sift reviewed its own PRs from day two. |
