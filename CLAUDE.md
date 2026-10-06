@AGENTS.md

# Current state (update in every PR)

Sift: AI code reviewer (Microsoft Innovate 2026, Problem 8). Repo `ydvSajal/Microsoft-me-`; live at https://microsoft-me.vercel.app (Vercel team `sky-fb86e046`, Neon project `sift`). Finale 2026-10-08.

## Demo flow
`/review` ("Try a file"): upload or paste one TS/JS file, get ranked findings (category, severity, friendly body, suggested fix), apply fixes in the browser. PR mode runs via the GitHub Action in `ydvSajal/sift-demo-shop`; the dashboard reads ingested reviews.

## In flight: demo polish (Kodus-inspired, ideas only: Kodus is AGPL, never copy its code)
Tickets T-41..T-44 in `docs/TASKS.md`, one PR each, in order:
- T-41 fix quality gate (`packages/ai/src/usable-fix.ts`): empty, unchanged or cut-off fixes are dropped, the finding stays. DONE (#32)
- T-42 written severity definitions: `SEVERITY_DEFINITIONS` in `@sift/shared` feeds the prompt (test guards drift), badge tooltips and the legend. DONE
- T-43 copy a fix prompt for Cursor/Claude Code: `apps/web/lib/fix-prompt.ts`, buttons in `FixPanel`. DONE (copy-all and apply verified in headless Chrome)
- T-44 cached showcase reviews on `/review`: `apps/web/lib/showcase/*.json`, recorded by `pnpm --filter web showcase:record` (dev only, primary model only; re-run if the prompt changes). DONE
Gotcha: when Gemini is slow or rate-limited the fallback model (free OpenRouter) often returns findings with no `suggestion`; check which model produced a recording.
Later: GitHub login + repo selection (T-34/T-31), team rules in plain English.

## Demo readiness (2026-10-07)
Runbook: `docs/SUPPORT.md` §3. Live and local reviews verified (~15 s); `deploy-smoke` green. Local run needs `apps/web/.env.local` (copy the root `.env`: Next does not read it from the repo root). Decision: no backup video and no hotspot run (T-22 partly skipped). Still open: shop repo secrets `SIFT_API_URL`/`SIFT_INGEST_SECRET`, `SIFT_GITHUB_TOKEN` for `/connect`.

## In flight: buddy, accounts, Telegram (un-parked 2026-10-07)
Plan: T-26 web buddy → T-45 accounts (hand-rolled scrypt + session cookie + GitHub OAuth, no auth lib) → T-46 watched repos → T-25 Telegram (one app bot, deep-link `/start <linkToken>`). Schema + migration `0003_accounts` shipped first (dry-run on a temp Neon branch: clean).
Neon MCP is connected (project `sift`, id `shy-block-91676913`): use temp branches for migration dry-runs; prod migrates only via `prisma migrate deploy` on the production build.

## Parked (not for the Oct 8 demo)
T-23, T-24, T-27 (auto-mute, convention mining, buddy firmware). Don't start them.

## Rules of thumb
- Wait for each PR to merge before branching the next; ship with `scripts/ship.sh` (stash untracked files first: `git stash -u`).
- Previews never run `prisma migrate deploy` (production builds only).
- Tests never call a real LLM or GitHub. pnpm 11, Node 26, AI SDK v7.
- Don't set secrets or Vercel env yourself; ask the user.
