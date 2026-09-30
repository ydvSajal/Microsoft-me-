# DEPLOYMENT — solo

## 1. Local setup (~10 min)

```bash
corepack enable                        # gives you the pinned pnpm
git clone https://github.com/<you>/sift.git && cd sift
pnpm install
cp .env.example .env                   # fill as you reach each ticket
pnpm typecheck && pnpm test
```

| To run | Command | Needs in `.env` |
|---|---|---|
| CLI | `pnpm sift review path/to/file.ts` | `SIFT_AI_PROVIDER`, model + provider keys |
| Web app | `pnpm --filter web db:migrate && pnpm --filter web db:seed && pnpm --filter web dev` | `DATABASE_URL`, `DIRECT_URL`, `SIFT_INGEST_SECRET`, `SIFT_DEMO_PASSCODE` |
| Action locally against a demo PR | `SIFT_WORKSPACE=../sift-demo-shop GITHUB_EVENT_PATH=./pr-event.json pnpm --filter action start` (save a real `pull_request` payload from a run's logs as `pr-event.json`) | all of the above + a fine-grained `GITHUB_TOKEN` for the demo repo |

## 2. Repo setup and protection (once, T-01)

**Prerequisite:** branch protection on a **private** repo needs GitHub Pro (included in the Student Developer Pack). The simplest option is to make `sift` **public**, which also lets the demo repo's workflow check it out without a token.

```bash
gh auth login                          # admin on the repo
./scripts/setup-repo.sh <you>/sift
```

The script:
- sets squash-merge only, auto-delete branches and **auto-merge on**;
- creates labels;
- creates the repo variable `SIFT_SELF_REVIEW=false`;
- protects `main`:
  - PR required, **0 approvals**
  - required checks `ci-checks` + `pr-hygiene`, not strict
  - conversations resolved
  - linear history
  - no force-push or deletion
  - **admins included**

**Verify:**
```bash
git checkout main && echo test >> README.md && git commit -am "test" && git push
# expected: rejected — protected branch
git reset --hard origin/main
```

## 3. CI/CD pipeline

```
 branch ──► scripts/ship.sh ──► PR ──┬─► ci-checks  (required) ─┐
                                     ├─► pr-hygiene (required) ─┼─► auto-merge (squash) ──► main
                                     ├─► firmware-build (if firmware/ changed)             │
                                     ├─► sift-self-review (advisory, after T-10)           │
                                     └─► Vercel preview ──► deploy-smoke                   │
                                                                                            ▼
                              main ──► ci-checks again ──► Vercel production ──► deploy-smoke
                                   └─► the demo repo's Action runs Sift from sift@main on its next PR
```

| Deliverable | How it deploys | Verified by |
|---|---|---|
| Review pipeline (Action) | **Merging to `main` is the release.** The demo repo's workflow checks out `sift@main` on every run. | Next demo-repo PR |
| Web app + API | Vercel Git integration: preview per PR, production per merge | `deploy-smoke.yml` → `/api/health` |
| DB schema | `prisma migrate deploy` inside the Vercel build | Build log + smoke check (`db: true`) |
| CLI | Run from the repo (`pnpm sift`) | `ci-checks` |
| Firmware | `firmware.yml` compiles and uploads `firmware.bin` as an artifact on `main`; flash locally | `firmware-build` |

**Turning on self-review** (after T-10 works on the demo repo):
1. Add the same model secrets to the **sift** repo: `GOOGLE_GENERATIVE_AI_API_KEY` and/or `OPENROUTER_API_KEY`, `SIFT_MODEL`, `SIFT_JUDGE_MODEL`, plus the repo variable `SIFT_AI_PROVIDER` (`gemini` or `openrouter`). Optionally add `SIFT_API_URL` + `SIFT_INGEST_SECRET` so the dashboard sees these reviews too.
2. `gh variable set SIFT_SELF_REVIEW --body true --repo <you>/sift`

From then on, every PR you open gets reviewed by the version of Sift on `main`, never by the PR's own code. So a broken PR can't break its own reviewer.

## 4. Running Sift on the demo repo (T-06)

**In `sift-demo-shop`, add these repo secrets** (Settings → Secrets and variables → Actions):
- `GOOGLE_GENERATIVE_AI_API_KEY` and/or `OPENROUTER_API_KEY`, `SIFT_MODEL`, `SIFT_JUDGE_MODEL`
- `SIFT_API_URL`: the Vercel URL, e.g. `https://sift-web.vercel.app`
- `SIFT_INGEST_SECRET`: must match the web app

**Add a repo variable:** `SIFT_FEATURES=impact,stack,conventions,feedback`. Remove a flag to switch that feature off instantly.

**`.github/workflows/sift.yml` in `sift-demo-shop`:**

```yaml
name: Sift review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  pull_request_review_comment:
    types: [created]          # picks up /sift accept|ignore replies

permissions:
  contents: read
  pull-requests: write
  issues: write               # labels

concurrency:
  group: sift-${{ github.event_name }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # PR line numbers refer to head, not the merge commit
          fetch-depth: 0                       # needed for patch-id + impact analysis
      - uses: actions/checkout@v4
        with:
          repository: <LEAD_HANDLE>/sift
          ref: main
          path: .sift
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: .sift/package.json
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: .sift/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: .sift
      - run: pnpm --filter action start
        working-directory: .sift
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SIFT_WORKSPACE: ${{ github.workspace }}
          SIFT_FEATURES: ${{ vars.SIFT_FEATURES }}
          SIFT_AI_PROVIDER: ${{ vars.SIFT_AI_PROVIDER }}
          GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          SIFT_MODEL: ${{ secrets.SIFT_MODEL }}
          SIFT_JUDGE_MODEL: ${{ secrets.SIFT_JUDGE_MODEL }}
          SIFT_API_URL: ${{ secrets.SIFT_API_URL }}
          SIFT_INGEST_SECRET: ${{ secrets.SIFT_INGEST_SECRET }}
```

Notes:
- **No branch filter**, so upper layers of stacked PRs (which target other branches, not `main`) still trigger.
- **Never switch to `pull_request_target`:** it would expose secrets to fork PRs.
- `.sift/` sits inside the workspace; core's `SKIP_PATTERNS` excludes it from review and impact analysis.

**Protect `main` on `sift-demo-shop` too**, with 1 required human approval. This is the "human is the required approver" proof in the demo.

## 5. Web app: continuous deployment (Vercel + Postgres)

1. Create a Postgres database on Neon or Supabase. Copy the pooled URL → `DATABASE_URL` and the direct URL → `DIRECT_URL`.
2. Vercel → New Project → import `sift` → **Root Directory: `apps/web`**. Vercel detects pnpm workspaces.
3. Build command: `pnpm prisma migrate deploy && pnpm build`. Set this as the `vercel-build` script in `apps/web/package.json`.
4. Environment variables (Production + Preview):
   - `DATABASE_URL`, `DIRECT_URL`
   - `SIFT_INGEST_SECRET`, `SIFT_DEMO_PASSCODE`
   - `SIFT_AI_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY` / `OPENROUTER_API_KEY`, `SIFT_MODEL`, `SIFT_JUDGE_MODEL` (for `/review`)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WAIT_HOURS`
5. Seed once from your machine, pointed at production: `pnpm --filter web db:seed`. This prints the device token and Telegram link tokens. Store them somewhere private.
6. Every PR gets a **preview deployment**; every merge to `main` deploys **production**. `deploy-smoke.yml` then calls `GET /api/health` on the new URL and goes red if the app or DB is down.
7. In Vercel → Settings → Git, keep "Ignored Build Step" off, so every merge to `main` deploys, even docs-only ones.

## 6. Deploy smoke check

`deploy-smoke.yml` runs on every successful Vercel deployment. Vercel's GitHub integration reports a `deployment_status` event. The workflow calls `<deployment URL>/api/health` and fails unless it gets `{"ok": true, "db": true}`.

- Preview deployments protected by Vercel Authentication return 401. Either disable protection for previews, or add the repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection → Protection Bypass for Automation). The workflow sends it when present.

## 7. Telegram bot (P3, T-25)

```bash
# 1. Create the bot with @BotFather → copy the token into TELEGRAM_BOT_TOKEN
# 2. Register the webhook (after the web app is deployed)
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$SIFT_API_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
# 3. Check
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Link your chat by sending `/start <github-login> <link-token>` to the bot.

## 8. Buddy firmware (P3, T-27)

```bash
cd firmware/buddy
cp include/secrets.example.h include/secrets.h   # gitignored
# edit: WIFI_SSID / WIFI_PASS (phone hotspot), API_URL, DEVICE_TOKEN
pio run -t upload                                # hold BOOT if the port isn't detected
pio device monitor
```

On the ESP32-S3, enable USB CDC on boot (already set in `platformio.ini` build flags) or the serial monitor stays silent.

## 9. Environment variables

The canonical list is in `.env.example`. Summary:

| Variable | Used by | Purpose |
|---|---|---|
| `SIFT_AI_PROVIDER` | ai | `gemini` (default) or `openrouter`; add more in `packages/ai/src/provider.ts` |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY` | ai | Provider credentials (only the selected provider's key is needed) |
| `SIFT_MODEL`, `SIFT_JUDGE_MODEL` | ai | Model names for review and judge (judge falls back to `SIFT_MODEL`) |
| `SIFT_FEATURES` | core | Comma list: `impact,stack,conventions,feedback` |
| `SIFT_API_URL` | core | Web app base URL |
| `SIFT_INGEST_SECRET` | core, web | Shared Bearer secret for ingest and config |
| `SIFT_WORKSPACE` | core | Path of the checked-out target repo |
| `DATABASE_URL`, `DIRECT_URL` | web | Postgres (pooled / direct for migrations) |
| `SIFT_DEMO_PASSCODE` | web | Protects `/review` and `/api/review-file` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | web | Bot + webhook verification |
| `SIFT_SELF_REVIEW` (repo variable) | sift repo CI | `true` turns on Sift reviewing its own PRs |
| `WAIT_HOURS` | web, shared | Threshold for "PR waiting" pings and the impatient mood |

## 10. Release checklist (before each gate and demo day)

- [ ] `main` is green; Vercel production deploy matches the latest `main` commit
- [ ] A fresh PR on `sift-demo-shop` gets a review in ≤ 90 s with a label
- [ ] Re-push posts nothing new; stack rebase posts nothing
- [ ] Dashboard shows the new review; `deploy-smoke` green on the production deploy
- [ ] (P3) Telegram ping arrives for a high-risk PR
- [ ] (P3) Buddy connects on the **phone hotspot** and reacts; demo mode works offline
- [ ] Backup video plays offline from a laptop
