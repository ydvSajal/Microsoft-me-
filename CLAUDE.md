@AGENTS.md

# Current state (update in every PR)

Sift: AI code reviewer (Microsoft Innovate 2026, Problem 8). Repo `ydvSajal/Microsoft-me-`; live at https://microsoft-me.vercel.app (Vercel team `sky-fb86e046`, Neon project `sift`). Finale 2026-10-08.

## Demo flow
`/review` ("Try a file"): upload or paste one TS/JS file, get ranked findings (category, severity, friendly body, suggested fix), apply fixes in the browser. PR mode runs via the GitHub Action in `ydvSajal/sift-demo-shop`; the dashboard reads ingested reviews.

## In flight: demo polish (Kodus-inspired, ideas only: Kodus is AGPL, never copy its code)
Tickets T-41..T-44 in `docs/TASKS.md`, one PR each, in order:
- T-41 fix quality gate (`packages/ai/src/usable-fix.ts`): empty, unchanged or cut-off fixes are dropped, the finding stays. DONE (#32)
- T-42 written severity definitions: `SEVERITY_DEFINITIONS` in `@sift/shared` feeds the prompt (test guards drift), badge tooltips and the legend. DONE
- T-43 copy a fix prompt for Cursor/Claude Code.
- T-44 cached showcase reviews on `/review`.
Later: GitHub login + repo selection (T-34/T-31), team rules in plain English.

## Rules of thumb
- Wait for each PR to merge before branching the next; ship with `scripts/ship.sh` (stash untracked files first: `git stash -u`).
- Previews never run `prisma migrate deploy` (production builds only).
- Tests never call a real LLM or GitHub. pnpm 11, Node 26, AI SDK v7.
- Don't set secrets or Vercel env yourself; ask the user.
