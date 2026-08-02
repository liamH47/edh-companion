# End-to-end tests

Playwright specs that drive a **running, packaged app** — not a dev server, and not
mocked modules. Everything below the browser is real: the built bundle, FastAPI, the
card API, and the SPA catch-all.

## What these are for

The unit suites are thorough (100% coverage on both sides), and they still cannot see:

- the Dockerfile copying the build output to the wrong path — `/healthz` stays green
  because it is a FastAPI route that never touches the frontend, so the container looks
  healthy while every page 404s
- `mount_frontend`'s catch-all failing to serve a deep link like `/cards/blood-artist`,
  which **only exists in the packaged app** (in dev, Vite handles unknown paths)
- the generated token CSS not making it into the bundle
- the API and the frontend disagreeing about a card that exists

Those are the failure modes of packaging and wiring, and this suite exists for them.
Arithmetic and pairing logic are tested far more thoroughly by the unit suites — don't
duplicate that here.

## Running them

CI builds the real image (`docker-e2e` job). Locally you have two options.

### Against the Docker image (closest to CI)

```
docker build -t mtg-calc .
docker run --rm -d --name mtg-calc-local -p 8080:8080 mtg-calc
npm run e2e
docker rm -f mtg-calc-local
```

### Without Docker

The container just runs FastAPI with the built frontend copied to `app/static`, so you
can reproduce that path directly:

```
cd frontend && npm run build && cd ..
rm -rf backend/app/static && cp -r frontend/dist backend/app/static
cd backend && uv run python -m uvicorn app.main:app --port 8080
```

Then in another shell:

```
npm run e2e                # both viewports
npm run e2e -- --project=desktop-chromium
npm run e2e:ui             # interactive
```

`backend/app/static/` is gitignored. Rebuild it whenever the frontend changes — it is a
copy, not a link, so it goes stale silently.

First run needs the browser: `npm run e2e:install`.

Point at a different target with `E2E_BASE_URL`, including the live site:

```
E2E_BASE_URL=https://mtg-calc.onrender.com npm run e2e
```

## Conventions

- **Query by role and accessible name**, matching the Vitest suites. These should break
  when the app becomes unusable, not when markup is reshuffled.
- **Assert only what is deterministic.** Round 1 of a Swiss event uses seat pairing
  (seat *i* plays seat *i + ⌊N/2⌋*) so exact pairings are safe to assert; round 2 onward
  shuffles within score groups, so assert structure and standings instead. The coin flip
  is random — assert that *a* result arrives, never which one.
- **No mocking**, with one exception: `swiss.spec.ts` aborts `**/api/**` to prove the
  Pairings tab survives a backend outage, which is the whole reason Swiss is
  client-side.

## Verifying the suite still catches things

A green E2E run is only worth what it would have caught. To confirm it still bites:

```
mv backend/app/static backend/app/static-parked   # simulate a wrong COPY
# restart the server, then:
npm run e2e
```

Expect 12 of 13 specs to fail. The one that passes —
"keeps API routes from being shadowed by the catch-all" — is correct to pass, since the
health probes and card API genuinely work without a frontend. That asymmetry is exactly
the bug class this suite exists to catch: **the server is fine, the app is not.**
