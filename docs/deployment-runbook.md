# Deployment & rollback runbook

Covers the "quick and cheap" deployment path: a single Docker container (frontend +
backend combined, see `Dockerfile`) deployed to [Render](https://render.com) (Starter plan),
declared via `render.yaml` (a Render Blueprint). This app's own infrastructure stays
intentionally simple — the k8s/Terraform/observability portfolio work now lives in a separate
project entirely, not attached to this one.

This has been verified end-to-end against a real deploy: the app is live and working.

## Architecture in one paragraph

`Dockerfile` is a three-stage build: a Node stage builds the React frontend
(`apps/web/dist`), a Python/uv stage installs backend dependencies, and a final slim Python
runtime stage combines both, running `app.main:app` under `uvicorn` as a non-root user.
FastAPI serves the API under `/api/*`, health checks at `/healthz`/`/readyz`, and the built
frontend for everything else (see `backend/app/frontend.py`).

**The app itself no longer calls the API.** Card metadata is bundled and compute runs in
the browser, so every tab works with no connection. The backend still serves `/api/*` as
canonical data and, more importantly, remains the source of truth that
`backend/tools/generate_parity_corpus.py` generates the TypeScript port's test corpus
from — but a failure there degrades nothing a user can see. Render injects a `PORT` env
var (default 10000) that the container's `CMD` reads at startup — see the comment in the
Dockerfile if this ever needs changing.

## First-time setup (one-time, manual — do this yourself)

GitHub/Render credentials were deliberately kept out of the assistant session for this
project (an unrelated org's access was a concern), so this part is manual:

1. **Review the working tree.** `git status` at the repo root — everything built so far
   (backend, frontend, this Dockerfile/render.yaml/runbook) is uncommitted. Review, then:
   ```
   git add -A
   git commit -m "Initial Commander's Companion app + coin flip + deployment config"
   ```
2. **Create the GitHub repo** (public, per your earlier choice) — either via
   `gh repo create mtg-calc --public --source=. --remote=origin` if you have `gh` set up
   with an account/token scoped appropriately, or manually at github.com/new, then:
   ```
   git remote add origin https://github.com/<your-username>/mtg-calc.git
   git push -u origin main
   ```
3. **Create a Render account** at render.com (GitHub sign-in is easiest) if you don't have
   one.
4. **New Blueprint**: Render dashboard → New → Blueprint → connect the `mtg-calc` GitHub
   repo. Render reads `render.yaml` automatically and proposes the `mtg-calc` web service
   (Docker runtime, free plan). Confirm and deploy.
5. **First build**: watch the build logs in the Render dashboard. This is the first real
   test of the Dockerfile — if it fails, see Troubleshooting below. Expect several minutes
   (Node + Python + Docker layer builds on a free-tier instance are not fast).
6. Once live, Render gives you a URL like `https://mtg-calc.onrender.com`. Open it and
   confirm the calculator and coin flip both work.

## Normal deploy flow (after first-time setup)

**Deploys are gated on CI.** `render.yaml` sets `autoDeployTrigger: checksPass`, so Render
watches the GitHub Checks API and deploys a commit on `main` only once every check on it is
green. There is no deploy job in the workflow and no deploy hook — Render does the gating.
So the flow is:

```
git push origin <branch>     # open a PR; CI runs
# merge the PR once checks are green
```

Merging to `main` runs CI once more; Render holds the deploy until those checks conclude. A
red build on `main` deploys nothing and leaves the previous release live.

Two behaviours of `checksPass` worth internalising:

- **Zero checks detected on a commit means no deploy, silently.** That's the safe
  direction, but if deploys ever stop mysteriously, first confirm CI actually ran on that
  commit rather than assuming Render is broken:
  ```
  gh api "repos/liamH47/edh-companion/actions/runs?head_sha=$(git rev-parse HEAD)" --jq .total_count
  ```
  `0` means the push event never produced a run — GitHub dropped or delayed it, most
  likely an Actions incident (check <https://www.githubstatus.com>). **The fix is to
  dispatch CI by hand** against `main`, which runs the jobs on its current HEAD and
  reports checks on that SHA, satisfying `checksPass`:
  ```
  gh workflow run ci.yml --ref main
  ```
  This is the whole reason `ci.yml` carries a `workflow_dispatch` trigger; the trigger's
  own comment records the incident that motivated it. Before it existed the only way to
  un-stick a deploy was pushing an empty commit to `main`.
- **Render counts a check as passed if it concluded `success`, `neutral`, or `skipped`.**
  A conditionally-skipped job therefore never blocks a deploy — don't rely on one as a gate.
- **Every check on the commit gates the deploy, not a chosen subset.** Adding a slow job to
  the push-to-`main` trigger slows every deploy, and a flaky one blocks them. Keep mobile
  E2E on `workflow_dispatch` for this reason.

Watch the deploy in the Render dashboard (Events tab) or via:
```
# if gh/render CLIs are set up
render deploys list mtg-calc
```

### One-time CI setup (manual — do this yourself)

Two steps, both in dashboards rather than the repo.

---

#### Step 1 — Confirm the Render service picked up `checksPass`

*Why:* `render.yaml` declares `autoDeployTrigger: checksPass`, but Blueprint sync does
**not** reliably push deploy settings onto a service that already exists. If the dashboard
still says "On Commit", every push to `main` deploys immediately without waiting for CI —
the exact hole this is meant to close. Verify rather than assume.

1. <https://dashboard.render.com> → the **`mtg-calc`** service → **Settings**.
2. Find **Build & Deploy** → **Auto-Deploy**.
3. It should read **After CI Checks Pass**. If it says "On Commit" (or "Yes"), click
   **Edit**, change it, and save.

**Verify:** push a commit to `main` and watch the Render **Events** tab — the deploy should
appear only after the GitHub Actions run concludes, not within seconds of the push.

---

#### Step 2 — Protect `main`

*Why:* `checksPass` gates what Render deploys, not what reaches `main`. Without branch
protection a direct `git push origin main` still lands unreviewed, untested code on the
default branch — Render just declines to ship it, which is a confusing failure mode rather
than a prevented one.

Status checks only appear in the picker **after they have run at least once** on the repo.
CI has already run, so both will be searchable.

1. Repo → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
   (Older repos may show **Settings** → **Branches** → **Add branch protection rule**; the
   option names below are the same either way.)
2. **Name:** `main protection`. **Enforcement status:** Active.
3. **Target branches** → Add target → **Include default branch**.
4. Enable:
   - **Require a pull request before merging** (Required approvals `0` is fine solo — the
     point is forcing the PR, which is what makes checks run).
   - **Require status checks to pass** → **Add checks**, then add both:
     - `Backend (ruff, mypy, pytest)`
     - `Frontend (tsc, oxlint, vitest)`
   - **Block force pushes**.
5. **Create**.

> **Gotcha:** as repo owner you can bypass rulesets by default. Leave the **Bypass list**
> empty or the protection is decorative for the only person using the repo.

**Verify** with the negative test:
```
git checkout main && git pull
echo "# test" >> README.md
git commit -am "should be rejected" && git push origin main
```
Expect a rejection citing the protected branch, then undo it:
```
git reset --hard origin/main
```

---

#### On deploy hooks

This setup uses none. A deploy hook is a URL whose `key=` query param is the entire
credential — anyone holding it can trigger a production deploy, it never expires, and it
works **regardless of the Auto-Deploy setting**. Switching to `checksPass` does not disable
existing hooks.

If a hook URL has ever been shared — pasted into a chat, an issue, a commit, a screenshot —
regenerate it: Render → service → **Settings** → **Deploy Hook** → **Regenerate**. That
invalidates the old URL immediately. Nothing in this repo depends on one.

---

### Deploying without a code change

To redeploy the current `main` (e.g. after a rollback, or to pick up an env var change),
use the Render dashboard's **Manual Deploy** button (service → Manual Deploy → Deploy
latest commit). That path bypasses the CI gate by design, so prefer it only when you know
the commit is already green.

## Verifying a deploy

After a deploy finishes (Render marks it "Live"):
1. `curl https://<your-app>.onrender.com/healthz` → expect `{"status":"ok"}`.
2. Open the app in a browser, run the Aetherflux Reservoir calculator with a known
   input (e.g. 4 spells cast, Reservoir in play since turn start → 10 total life gained,
   4 life this spell — see `backend/tests/test_aetherflux_reservoir.py` for more worked
   examples) and confirm the numbers match.
3. Try the Coin Flip tab once.

If any of these fail, do not consider the deploy good — move to Rollback.

## Rollback

Render keeps a history of previous successful deploys per service, and rolling back does
**not** require a new commit or revert:

1. Render dashboard → the `mtg-calc` service → **Events** (or **Deploys**) tab.
2. Find the last known-good deploy in the list.
3. Click it → **Rollback to this deploy** (Render redeploys that exact previous build).
4. Re-run the verification steps above against the rolled-back version.

A bad deploy cannot re-ship on its own — Render only deploys a `main` commit whose checks
are green — so a rollback stays rolled back while you fix forward.

For a code-level rollback (not just Render's deploy history), standard git revert works
fine too. It goes through CI like any other change, so the reverted state is tested before
it deploys:
```
git revert <bad-commit-sha>
# push to a branch, open a PR, merge once green
```

## Troubleshooting

- **Docker build fails on Render but nothing changed locally**: the build has never been
  tested locally (no Docker installed as of writing). Install Docker Desktop and run
  `docker build -t mtg-calc .` from the repo root to reproduce the failure locally with
  faster iteration than pushing and waiting on Render each time.
- **App builds but health check never passes**: almost always a `PORT` mismatch — confirm
  the Dockerfile's `CMD` is still reading `$PORT` (Render sets this to `10000` by default;
  see the Dockerfile comment) rather than a hardcoded port.
- **App works but is slow on first request after a while**: this deployment is on the Starter
  plan (no sleep-on-inactivity), so this would now indicate a real issue — check Render's
  dashboard for restarts/OOM kills rather than assuming it's expected. (Free-tier services do
  sleep after ~15 min of inactivity with a 30-60s cold start; that's not this deployment.)
- **Static assets 404 in production but work in local dev**: check that
  `backend/app/frontend.py`'s `mount_frontend` is finding a non-empty `app/static/`
  directory inside the image — this is where the Dockerfile copies `apps/web/dist` to. A
  `docker run --rm -it mtg-calc sh` (once Docker's available locally) and `ls app/static`
  is the fastest way to check.
- **New card/feature works locally but not in prod**: confirm it's on `main` *and* that the
  CI run for that merge was green — a red job means Render never deploys, so `main` can sit
  ahead of what's live indefinitely. Check the Actions tab first, Render's Events tab second.
- **CI green but no deploy fired**: check Auto-Deploy still reads "After CI Checks Pass" in
  the Render dashboard (Blueprint sync doesn't reliably update an existing service). If a
  commit somehow reported *zero* checks, Render deliberately does nothing and says nothing —
  confirm the workflow actually triggered on that commit.
- **A deploy fired despite a failing job**: Render counts `success`, `neutral`, and
  `skipped` as passing. A job that was skipped rather than run does not block a deploy.

## Known limitations of this deployment (by design, for now)

- Single instance, no autoscaling (Starter plan). The k8s/HPA work described in the SRE/SWE
  portfolio plan lives in a separate project entirely now, not attached to this app.
- No persistent storage or database — this app doesn't need any (all state is client-side
  per browser session), so this isn't a gap, just worth noting if that ever changes.
- No custom domain configured yet; Render's `onrender.com` subdomain is fine for sharing
  with friends. Worth adding later if this becomes more than a hobby link.
- No end-to-end test against the built image yet — CI runs unit tests and type/lint checks,
  but nothing exercises the Docker image the way a browser does, so a packaging regression
  (a bad `COPY` path, a broken SPA catch-all) would still reach production. Playwright
  against the container is the next piece of this.

## Running the checks locally

CI runs exactly these, so reproducing a red build is a copy-paste:

```
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest
cd apps/web && npm run tokens:check && npx tsc -b && npx oxlint && npx vitest run --coverage
```

Node version is pinned in `.nvmrc` (24, matching `node:24-alpine` in the Dockerfile). If
you use `nvm`, `nvm use` at the repo root picks it up.
