# Deployment & rollback runbook

Covers the "quick and cheap" deployment path: a single Docker container (frontend +
backend combined, see `Dockerfile`) deployed to [Render](https://render.com)'s free web
service tier, declared via `render.yaml` (a Render Blueprint). This is intentionally
separate from the larger local-kind/Terraform/AWS portfolio track described in the main
project plan — it exists to get a real, working URL live quickly.

**Caveat**: the steps below have not been end-to-end verified against a real deploy as of
writing (no Docker installed locally to build-test the image, and GitHub/Render access was
deliberately kept out of this session — see "First-time setup"). Treat this as a solid
starting runbook, not a proven one; update it with anything that turns out to be wrong the
first time through.

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

`autoDeploy: true` in `render.yaml` means **every push to `main` auto-deploys**. There is no
separate manual deploy step for routine changes:

```
git push origin main
```

Watch the deploy in the Render dashboard (Events tab) or via:
```
# if gh/render CLIs are set up
render deploys list mtg-calc
```

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

If the bad deploy also needs to stop auto-redeploying from `main` while you fix it: toggle
`autoDeploy` off in the service's Settings, or set it to `false` in `render.yaml` and push
that one change — do this deliberately, and remember to turn it back on once fixed.

For a code-level rollback (not just Render's deploy history), standard git revert works
fine too, and will itself trigger a new auto-deploy of the reverted state:
```
git revert <bad-commit-sha>
git push origin main
```

## Troubleshooting

- **Docker build fails on Render but nothing changed locally**: the build has never been
  tested locally (no Docker installed as of writing). Install Docker Desktop and run
  `docker build -t mtg-calc .` from the repo root to reproduce the failure locally with
  faster iteration than pushing and waiting on Render each time.
- **App builds but health check never passes**: almost always a `PORT` mismatch — confirm
  the Dockerfile's `CMD` is still reading `$PORT` (Render sets this to `10000` by default;
  see the Dockerfile comment) rather than a hardcoded port.
- **App works but is slow on first request after a while**: expected on Render's free tier
  — free web services sleep after ~15 minutes of inactivity and take 30-60s to wake on the
  next request. Not a bug; upgrading off the free plan removes this if it becomes annoying.
- **Static assets 404 in production but work in local dev**: check that
  `backend/app/frontend.py`'s `mount_frontend` is finding a non-empty `app/static/`
  directory inside the image — this is where the Dockerfile copies `frontend/dist` to. A
  `docker run --rm -it mtg-calc sh` (once Docker's available locally) and `ls app/static`
  is the fastest way to check.
- **New card/feature works locally but not in prod**: confirm it's actually on `main` and
  pushed — `autoDeploy` only watches the branch Render is configured to track (`main` by
  default).

## Known limitations of this deployment (by design, for now)

- Single instance, no autoscaling (free tier). The k8s/HPA milestones in the main project
  plan cover that separately, later, against a different target.
- No persistent storage or database — this app doesn't need any (all state is client-side
  per browser session), so this isn't a gap, just worth noting if that ever changes.
- No custom domain configured yet; Render's `onrender.com` subdomain is fine for sharing
  with friends. Worth adding later if this becomes more than a hobby link.
- No CI checks gating the deploy yet (lint/test/coverage all currently run locally, not in
  a pipeline) — that's `ci-app.yml`/`ci-terraform.yml` from the main project plan, still
  to be built. Until then, run the local checks before pushing to `main`:
  ```
  cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest
  cd frontend && npx tsc -b && npx oxlint && npx vitest run --coverage
  ```
