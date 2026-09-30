# CONTRIBUTING — solo workflow (master file)

This is the one file that governs how code reaches `main`. If another doc disagrees, this one wins.

**The rule:** every change lands on `main` through a pull request that passed CI. That includes changes made by you or by a coding agent. No approvals are needed (you're solo), but no PR, no merge.

**Why keep PRs when working alone:**
- CI runs on every change before it touches `main`.
- Vercel gives you a preview URL per PR.
- Once T-10 lands, Sift reviews its own PRs. That's your second pair of eyes, and a strong demo line.
- `main` stays deployable at every moment. That matters on Oct 7.

GitHub enforces this after you run `scripts/setup-repo.sh`: direct pushes to `main` are rejected, even for admins.

---

## 1. The fast loop

```bash
git checkout main && git pull
git checkout -b feat/t07-diff-map          # one ticket from docs/TASKS.md

# ...code, commit freely (branch commits are squashed away)...

scripts/ship.sh "feat(core): add diff map of commentable lines"
```

`scripts/ship.sh` does the whole release path in one command:
1. Rebases on `origin/main`.
2. Runs `pnpm format`, `lint`, `typecheck` and `test` locally, so a PR never fails on something trivial.
3. Pushes with `--force-with-lease`.
4. Opens the PR with the ticket ID taken from the branch name, **or** just updates it if it already exists.
5. Turns on **auto-merge (squash)**: the PR merges itself the moment CI is green, and the branch is deleted.

Later pushes to the same branch: run `scripts/ship.sh` again with no title.

Start the next ticket from a fresh `main` right away. You never wait on CI.

---

## 2. Naming

**Branches:** `<type>/t<nn>-<short-description>`. The ticket number is how `ship.sh` finds the ticket ID.

```
feat/t07-diff-map      fix/t10-grounding-422      chore/t01-bootstrap
```

**PR titles** follow Conventional Commits. The title becomes the only commit on `main`.

```
feat(core): add diff map of commentable lines
fix(ai): retry once when judge output fails schema
```

| Types | Scopes |
|---|---|
| `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci` `build` | `core` `ai` `web` `action` `cli` `shared` `bench` `firmware` `repo` |

The `pr-hygiene` check fails on a bad title or branch name, or if the description has no `T-nn` / `Ticket: none`.

---

## 3. Size and flags

- **One ticket per PR, under ~400 changed lines**, not counting `pnpm-lock.yaml` or fixtures. Small PRs make Sift's self-review useful and make reverting cheap.
- **Merge unfinished work behind a flag.** `SIFT_FEATURES=impact,stack,conventions,feedback`. Half-built code with its flag off is fine on `main`. A four-day branch is not.
- **Big ticket? Stack it.** Split it into layers: types → logic → wiring.
  ```bash
  git checkout -b feat/t16-impact-types          # layer 1, based on main
  scripts/ship.sh "feat(core): add impact analysis types"
  git checkout -b feat/t16-impact-refs           # layer 2, based on layer 1
  BASE=feat/t16-impact-types scripts/ship.sh "feat(core): find external references with ts-morph"
  ```
  When layer 1 merges and its branch is deleted, GitHub retargets layer 2 to `main`. Squash-merging rewrote layer 1's commits, so move layer 2 onto the new `main` once:
  ```bash
  git checkout feat/t16-impact-refs
  git fetch origin && git rebase --onto origin/main feat/t16-impact-types
  scripts/ship.sh                                 # re-runs checks; auto-merge is already on
  ```

**Why branches don't have to be "up to date" before merging:** `setup-repo.sh` sets `strict: false`, so an open PR doesn't need a rebase every time another PR merges. That's faster solo. The trade-off is covered by `ci.yml` running again on `main` after every merge. If `main` ever goes red, fixing it is the next PR, before anything else.

---

## 4. Required checks (the only gate)

| Check | Workflow | Required | What it does |
|---|---|---|---|
| `ci-checks` | `ci.yml` | Yes | format, lint, typecheck, test, package-boundary check |
| `pr-hygiene` | `pr-hygiene.yml` | Yes | title, branch, ticket ID; size warning |
| `firmware-build` | `firmware.yml` | No (path-filtered) | compiles `firmware/` only when it changes |
| `sift-self-review` | `sift-self-review.yml` | No (advisory) | Sift comments on its own PR once `SIFT_SELF_REVIEW=true` |
| `deploy-smoke` | `deploy-smoke.yml` | No (post-deploy) | hits `/api/health` on every Vercel deployment |

**Self-review etiquette:** read Sift's comments before the auto-merge lands.
- If it found something real, push a fix. The auto-merge waits, because checks re-run.
- If it's wrong, reply `/sift ignore`. That feeds real data into the precision dashboard for the demo.

---

## 5. Contracts first

`packages/shared/src/schemas.ts` is the contract between the CLI, the pipeline, the web app and the buddy.

- **Changing a contract?** Put the schema change and its fixture update in **its own PR first**. Then build the feature on top.
- This keeps every feature PR small, and it stops a half-done feature from leaving a broken type on `main`.

---

## 6. Definition of done (per ticket)

- [ ] Meets the acceptance criteria in `docs/TASKS.md`
- [ ] Merged via PR, with CI green
- [ ] Pure logic has unit tests: diff map, fingerprint, rank, risk, stack, mood, renderers
- [ ] No live LLM calls in tests; CI has no model keys, by design
- [ ] New env vars are in `.env.example` with a comment; no secrets in code
- [ ] Ticket checked off in `docs/TASKS.md` (in the same PR)

---

## 7. Working with coding agents

`AGENTS.md` holds the rules any coding agent must follow. Give an agent **one ticket at a time**, with:
- the ticket row from `docs/TASKS.md`,
- the relevant TRD section,
- the instruction to finish with `scripts/ship.sh`.

Review the diff yourself before the auto-merge fires. An agent's PR gets the same scrutiny as anyone's.

---

## 8. Escape hatches

| Situation | Do this |
|---|---|
| Need to stop an auto-merge | `gh pr merge --disable-auto <branch>` |
| Bad change landed on `main` | `gh pr create` from a `git revert <sha>` branch, then ship. Reverts go through PRs too. |
| CI is broken for reasons outside your code (GitHub outage) | Wait or re-run. Don't bypass. |
| Demo-day emergency, CI unusable | `docs/SUPPORT.md` §4 break-glass. Log what you merged and restore protection immediately. |
