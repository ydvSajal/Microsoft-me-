# TIMELINE — solo, Oct 1 → Oct 8, 2026

## Event dates (fixed)

| Date | Event | Impact |
|---|---|---|
| **Thu Oct 1** | Mentor evaluation (day 2) | If your slot is today, demo the CLI (T-05) on a real file |
| Mon Oct 5 | Physical hackathon list published | Feature freeze the same evening |
| **Wed Oct 7** | Day 1 on campus: top 20 advance | **Demo must be complete by end of Day 1** |
| **Thu Oct 8** | Grand finale | Same demo, tightened with Day 1 feedback |

**Still open:** is pre-building allowed? Confirm at the mentor round today. If not, see §5.

## Capacity check

That's 22 P0/P1 tickets in 6 working days, about 4 a day. It's only realistic because:
- each ticket is small and specified in TRD, so there's no design work left;
- coding agents do most of the typing (see `AGENTS.md`), while you review;
- CI plus auto-merge removes all waiting.

If you finish a day with tickets left, **don't carry them silently**. Apply the cut order in `docs/TASKS.md`.

## Day plan

| Date | Tickets | End-of-day proof |
|---|---|---|
| **Thu Oct 1** | T-01 → T-05 | `pnpm sift review` works on a real file; a direct push to `main` is rejected |
| **Fri Oct 2** | T-06 → T-10 | **Gate 1:** a real PR on `sift-demo-shop` gets validated, diff-scoped comments. Self-review on. |
| **Sat Oct 3** | T-11 → T-14 | **Gate 2:** ranked, deduped review with a risk label; re-push posts nothing new |
| **Sun Oct 4** | T-15 → T-17 | Stack rebase posts nothing; summary lists off-diff callers; 10 benchmark PRs labelled |
| **Mon Oct 5** | T-18 → T-21 | **Gate 3 (freeze, EOD):** dashboard live on Vercel; benchmark numbers generated |
| **Tue Oct 6** | T-22, fixes, rehearsal; P3 only if all gates were on time | Full dry run on the hotspot; backup video done |
| **Wed Oct 7** | Demo | Top 20 |
| **Thu Oct 8** | Finale | — |

## Gates

| Gate | Pass condition | If missed |
|---|---|---|
| **Gate 1** (Oct 2) | Action posts validated, diff-scoped comments on a real PR | Everything else stops until it passes. Mentors/judges see the CLI in the meantime. |
| **Gate 2** (Oct 3) | Ranked + deduped + labelled review; no repeats on re-push | Drop all P3 and T-20 immediately |
| **Gate 3** (Oct 5 EOD) | Freeze: `main` is the demo build | After this, only `fix:` / `docs:` PRs |

## Daily rhythm (solo)

| When | What |
|---|---|
| Start (10 min) | Pull `main`, check yesterday's `main` CI + the Vercel deploy, pick today's tickets |
| Per ticket | Branch → agent or code → review the diff → `scripts/ship.sh` → start the next one while CI runs |
| Midday (5 min) | On track for today's proof? If not, cut now, not at midnight |
| End (15 min) | Verify the end-of-day proof on the demo repo; tick `docs/TASKS.md`; note blockers for tomorrow |

## 5. If pre-building isn't allowed

Before Oct 7, only non-product prep:
- these docs
- prompts as markdown
- the demo repo + benchmark PRs and labels (T-06, T-17)
- UI sketches

On Oct 7, build the **Never cut** list in ticket order. Everything else becomes "what's next" on the finale slide.
