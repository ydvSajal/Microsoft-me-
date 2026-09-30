#!/usr/bin/env bash
# One-time solo repo setup: merge settings, auto-merge, labels, variables, branch protection on main.
# Usage: ./scripts/setup-repo.sh <owner/repo>
# Requires: gh CLI authenticated with admin rights on the repo.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <owner/repo>" >&2
  exit 1
fi

REPO="$1"
BRANCH="main"
REQUIRED_CHECKS='["ci-checks","pr-hygiene"]'

echo "==> Merge settings: squash only, auto-merge on, delete merged branches"
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY >/dev/null

echo "==> Labels"
create_label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; }
create_label "P0"               "d1242f" "Required by the problem statement or demo"
create_label "P1"               "fb8c00" "Differentiator"
create_label "P3"               "8c959f" "Only if ahead of schedule"
create_label "blocked"          "b60205" "Waiting on something external"
create_label "sift:risk-high"   "d1242f" "Set by Sift"
create_label "sift:risk-medium" "fb8c00" "Set by Sift"
create_label "sift:risk-low"    "2da44e" "Set by Sift"

echo "==> Repo variables"
gh variable set SIFT_SELF_REVIEW --body "false" --repo "$REPO"
gh variable set SIFT_FEATURES --body "impact,stack,feedback" --repo "$REPO"
gh variable set SIFT_AI_PROVIDER --body "gemini" --repo "$REPO"

echo "==> Branch protection on $BRANCH: PR required (0 approvals), checks required (non-strict), admins included"
gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<JSON >/dev/null
{
  "required_status_checks": { "strict": false, "contexts": $REQUIRED_CHECKS },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
JSON

echo "==> Done. Verify:"
echo "    gh api repos/$REPO/branches/$BRANCH/protection --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, admins: .enforce_admins.enabled}'"
echo "    Then try a direct push to $BRANCH: it must be rejected."
