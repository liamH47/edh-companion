---
name: add-card
description: "Add a new Magic card calculator to the app. Use when asked to add, implement, or port a card, for example add Tendrils of Agony or lets do Commander tax. Covers the two-sided Python and TypeScript implementation, the parity corpus, and the gates that fail until both exist."
---

# Adding a card

A card lives in **two** implementations. Python owns behaviour; TypeScript mirrors it so
the app computes offline. A generated corpus proves they agree, and CI fails until both
exist — so this is not a discipline problem, but it is a five-step job.

## 0. Verify the Oracle text first

**Do not write anything from memory.** Use the `rules-checker` agent, or check Scryfall
directly. This project has already been bitten four times by text that "sounded right" —
see `docs/future-card-ideas.md`.

You want: verbatim Oracle text including reminder text, the type line, and the specific
misreading the card invites.

## 1. Python module — `backend/app/cards/<card_name>.py`

Match the idiom of an existing module closely. Read a comparable one first:
`nykthos_shrine_to_nyx.py` for the minimal case, `brain_freeze.py` for a storm card, `scute_swarm.py` for a simulation,
`comet_stellar_pup.py` for an ordered sequence.

- Module docstring naming the card **and its wrinkle** — why it is worth a calculator.
- `MAX_*` constants rather than inline literals.
- `METADATA: CardMetadata` with `rules_text` as the **verbatim** Oracle text.
- `scryfall_id` — the card's Scryfall print id, which drives the "View card" image.
  `api.scryfall.com/cards/named?exact=<Name>` returns it as `id`. `test_registry.py`
  fails if a registered card has none, or if what it has is not a UUID.
- `short_label` on every field and output; exactly one `primary=True` output.
- `help_text` is rendered as **plain text, not markdown** — asterisks show up literally.
- `AlertSpec` only for a genuine state change worth a banner (lethal, died), not a stat.
- `compute(inputs) -> dict` — pure, no I/O.
- Comments explain the table situation, not the code.

Reuse shared helpers: `storm.py` for storm copy counts, `validation.py` handles all
bounds and type checking generically from the `FieldSpec`.

## 2. Register it — `backend/app/cards/registry.py`

Add to **both** the import list and `_MODULES`, alphabetically.

## 3. Python tests — `backend/tests/test_<card_name>.py`

Module-local `_inputs(**overrides)` helper, plain module-level functions, full type
annotations (mypy runs strict). Coverage is enforced at 100% branch, so every branch of
`compute()` needs a case — including `test_compute_at_upper_bound`. Add a worked-arithmetic
comment above anything non-obvious.

## 4. TypeScript mirror — `packages/core/src/cards/compute/<card-id>.ts`

Same logic, same output keys, and register it in `packages/core/src/cards/registry.ts`.

**Watch for arithmetic that overflows a JS number.** If the card can produce a value past
2^53 — anything doubling or exponential — compute in `bigint` and convert with `Number()`
only at the return boundary, summing in bigint first. See `scute-swarm.ts`, whose bounds
reach ~2^129.

## 5. Regenerate and verify

```
cd backend && uv run python tools/generate_parity_corpus.py
```

Then the full local gate:

```
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest
cd backend && uv run python tools/generate_parity_corpus.py --check
npm run typecheck --workspaces --if-present && npm run lint
cd packages/core && npx vitest run --coverage
cd apps/web && npx vitest run --coverage
```

## What fails if you skip a step

Worth knowing, because the failure names the problem:

- **Missing TypeScript side** → `registry completeness > implements exactly the cards the
  backend registers` fails, listing the card.
- **Forgot to regenerate** → `generate_parity_corpus.py --check` fails, naming the stale file.
- **The two disagree** → `parity: <card-id>` prints both sides' numbers for each mismatch.

## What needs no changes

The UI. Screens render generically from `FieldSpec` and `OutputSpec` — no per-card
branching anywhere (`docs/ui/screen-spec.md`). Only a genuinely new `FieldKind` would
require frontend work.

## Finally

Update `docs/future-card-ideas.md`: move the card into the shipped table with a one-line
note on the shape it demonstrates, so the next similar card has somewhere to look.
