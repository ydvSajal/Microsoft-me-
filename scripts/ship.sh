#!/usr/bin/env bash
# Rebase → local checks → push → open/update PR → enable auto-merge (squash).
# Usage (from a feature branch):
#   scripts/ship.sh "feat(core): add diff map"     # first time: opens the PR
#   scripts/ship.sh                                # later pushes: updates it
#   BASE=feat/t16-impact-types scripts/ship.sh "…" # stacked layer on another branch
set -euo pipefail

BASE="${BASE:-main}"
TITLE="${1:-}"
branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "main" ]]; then
  echo "You're on main. Create a branch first, e.g.: git checkout -b feat/t07-diff-map" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes. Commit them first (branch commits get squashed anyway)." >&2
  exit 1
fi

echo "==> Rebasing $branch onto origin/$BASE"
git fetch origin
git rebase "origin/$BASE"

echo "==> Local checks"
pnpm format
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A && git commit -q -m "chore: format"
fi
pnpm lint
pnpm check:boundaries
pnpm typecheck
pnpm test

echo "==> Pushing"
git push --force-with-lease -u origin "$branch"

ticket="$(grep -oE '^[a-z]+/t[0-9]{2}' <<< "$branch" | grep -oE '[0-9]{2}$' || true)"
ticket_line="Ticket: ${ticket:+T-$ticket}"
[[ -z "$ticket" ]] && ticket_line="Ticket: none"

if gh pr view "$branch" --json number >/dev/null 2>&1; then
  echo "==> PR already open; updated with the new push"
else
  if [[ -z "$TITLE" ]]; then
    echo "First ship needs a PR title, e.g.: scripts/ship.sh \"feat(core): add diff map\"" >&2
    exit 1
  fi
  echo "==> Opening PR against $BASE"
  gh pr create --base "$BASE" --head "$branch" --title "$TITLE" --body "$ticket_line"
fi

echo "==> Enabling auto-merge (squash) — merges when required checks pass"
gh pr merge "$branch" --auto --squash --delete-branch
gh pr view "$branch" --json url --jq .url
