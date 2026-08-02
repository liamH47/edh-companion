# Deployment & rollback runbook

Covers the "quick and cheap" deployment path: a single Docker container (frontend +
backend combined, see `Dockerfile`) deployed to [Render](https://render.com) (Starter plan),
declared via `render.yaml` (a Render Blueprint). This app's own infrastructure stays
intentionally simple — the k8s/Terraform/observability portfolio work now lives in a separate
project entirely, not attached to this one.

This has been verified end-to-end against a real deploy: the app is live and working.

## Architecture in one paragraph

`Dockerfile` is a three-stage build: a Node stage builds the React frontend
(`frontend/dist`), a Python/uv stage installs backend dependencies, and a final slim Python
runtime stage combines both, running `app.main:app` under `uvicorn` as a non-root user.
FastAPI serves the API under `/api/*`, health checks at `/healthz`/`/readyz`, and the built
frontend for everything else (see `backend/app/frontend.py`). Render injects a `PORT` env
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

**Deploys are gated on CI.** `autoDeploy` is `false` in `render.yaml`; what ships to Render
is the `deploy` job in `.github/workflows/ci.yml`, which runs only on `main` and only after
the backend and frontend jobs pass. So the flow is:

```
git push origin <branch>     # open a PR; CI runs
# merge the PR once checks are green
```

Merging to `main` runs CI once more and, if green, POSTs to the Render deploy hook. A red
build on `main` deploys nothing and leaves the previous release live.

Watch the deploy in the Render dashboard (Events tab) or via:
```
# if gh/render CLIs are set up
render deploys list mtg-calc
```

### One-time CI setup (manual — do this yourself)

1. **Add the deploy hook secret.** Render dashboard → the `mtg-calc` service → Settings →
   Deploy Hook → copy the URL. Then in GitHub: Settings → Secrets and variables → Actions →
   New repository secret, named `RENDER_DEPLOY_HOOK_URL`. The `deploy` job fails with an
   explicit error if this is missing, so a misconfiguration is loud rather than silent.
2. **Turn off Render's own auto-deploy in the dashboard too.** `render.yaml` sets
   `autoDeploy: false`, but a service created before that change may still have it enabled
   in its settings — Blueprint sync does not always override it. Check
   Settings → Build & Deploy → Auto-Deploy is "No".
3. **Protect `main`.** GitHub → Settings → Branches → add a rule for `main`: require pull
   requests, and require the `Backend (ruff, mypy, pytest)` and
   `Frontend (tsc, oxlint, vitest)` status checks to pass. Without this, CI is advisory —
   someone can still push straight to `main`.

### Deploying without a code change

To redeploy the current `main` (e.g. after a rollback, or to pick up an env var change),
POST to the deploy hook directly, or use the Render dashboard's "Manual Deploy" button.

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

A bad deploy cannot re-ship on its own — `autoDeploy` is off and only a green CI run on
`main` triggers the hook — so a rollback stays rolled back while you fix forward.

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
  directory inside the image — this is where the Dockerfile copies `frontend/dist` to. A
  `docker run --rm -it mtg-calc sh` (once Docker's available locally) and `ls app/static`
  is the fastest way to check.
- **New card/feature works locally but not in prod**: confirm it's on `main` *and* that the
  CI run for that merge went green all the way through the `deploy` job — a red backend or
  frontend job skips the deploy entirely, so `main` can be ahead of what's live. Check the
  Actions tab first, Render's Events tab second.
- **CI green but no deploy fired**: the `deploy` job only runs on `push` events to `main`,
  not on `pull_request`. If it ran and failed, the most likely cause is a missing or
  rotated `RENDER_DEPLOY_HOOK_URL` secret — the job prints an explicit error for that case.

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
cd frontend && npm run tokens:check && npx tsc -b && npx oxlint && npx vitest run --coverage
```

Node version is pinned in `.nvmrc` (24, matching `node:24-alpine` in the Dockerfile). If
you use `nvm`, `nvm use` at the repo root picks it up.
