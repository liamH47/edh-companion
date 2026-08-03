---
name: verify
description: "Run the full local check suite - backend lint, types and tests, parity corpus freshness, both frontend packages, and optionally end-to-end against the built artifact. Use before opening a PR, or when asked to verify, check, or confirm everything passes."
---

# Full local verification

Exactly what CI runs, so a red build is reproducible without pushing. Run from the repo
root.

## 1. Backend

```
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
```

`pyproject.toml` sets `--cov-fail-under=100` with branch coverage, so `pytest` is the
coverage gate as well as the test run.

## 2. Parity corpus is current

```
cd backend && uv run python tools/generate_parity_corpus.py --check
```

Fails if a Python card changed without the corpus being regenerated, or if a card was
added. Catches drift between the Python and TypeScript implementations at its source.

## 3. Frontend

```
npm run tokens:check -w @mtg/web
npm run typecheck --workspaces --if-present
npm run lint
cd packages/core && npx vitest run --coverage
cd apps/web && npx vitest run --coverage
```

Each package enforces its own 100% threshold on lines, branches, functions and
statements. `tokens:check` catches a `tokens.ts` edit that skipped regenerating the CSS.

## 4. End-to-end (optional locally, always in CI)

CI builds the real Docker image. Without Docker installed, reproduce the container's
serving path directly — it is the same FastAPI process serving the same built files:

```
npm run build
rm -rf backend/app/static && cp -r apps/web/dist backend/app/static
cd backend && uv run python -m uvicorn app.main:app --port 8080
```

Then in another shell:

```
E2E_BASE_URL=http://127.0.0.1:8080 npx playwright test
```

`backend/app/static/` is gitignored and is a **copy**, not a link — rebuild it whenever
the frontend changes or you will be testing stale output.

## Notes

- Node is pinned in `.nvmrc` to match the Dockerfile. A different major version is a
  plausible source of "works locally, fails in CI".
- Coverage thresholds are deliberately at 100%: they are what forces dead code out when
  something is deleted, rather than letting it linger untested.
- If only one package changed, running just that package's tests is fine while iterating
  — but run the whole thing before opening a PR.
