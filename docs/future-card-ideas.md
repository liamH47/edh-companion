# Future card ideas

Candidates for the next cards to add to the plugin registry (`backend/app/cards/`).

Before implementing anything here, re-verify the Oracle text against Scryfall or Gatherer
rather than trusting memory — this is exactly the kind of detail that's easy to
misremember. Two real examples from this project: the "spells cast **before** it" vs.
"this turn, inclusive" mixup caught in Aetherflux Reservoir's first implementation, and
Ob Nixilis, the Fallen turning out to be a **3/3 creature**, not the planeswalker
everyone pictures (that's Ob Nixilis Reignited).

Commander (EDH) relevance is the filter, and the pattern to fit is: few simple inputs,
one clear derived answer, no general game-state tracking.

## Shipped

Everything originally listed here has been built. Worth reading before adding a card of a
similar shape:

| Card | Module | Shape worth reusing |
|---|---|---|
| Aetherflux Reservoir | `aetherflux_reservoir.py` | Running totals with a baseline, plus an affordability guard on an action button |
| Craterhoof Behemoth | `craterhoof_behemoth.py` | "X = count of Y" resolved independently per trigger, since the board changes between them |
| Brain Freeze | `brain_freeze.py` | First storm card; shares `storm.py` |
| Grapeshot | `grapeshot.py` | Second storm card — near-trivial once `storm.py` existed |
| Ob Nixilis, the Fallen | `ob_nixilis_the_fallen.py` | Landfall grow-and-drain, with a trigger-doubler multiplier |
| Comet, Stellar Pup | `comet_stellar_pup.py` | The `sequence` field kind: an **ordered** log where order changes the answer |
| Blood Artist | `blood_artist.py` | The minimal case — two inputs, one product |
| Nykthos, Shrine to Nyx | `nykthos_shrine_to_nyx.py` | A pure tally, where the tedium is counting, not computing |
| Scute Swarm | `scute_swarm.py` | Threshold-gated simulation that can't be a closed-form sum |
| Tendrils of Agony | `tendrils_of_agony.py` | Third storm card — a drain, with a lethal alert |
| Empty the Warrens | `empty_the_warrens.py` | Fourth storm card — tokens |

**`storm.py`** is a shared non-card helper (the same supporting role `validation.py`
plays), and it paid off exactly as predicted: Tendrils of Agony and Empty the Warrens
were each a `METADATA` block plus a one-line per-copy effect. Any future storm card is
the same.

Note that a card now needs **two** implementations — Python in `backend/app/cards/` and
TypeScript in `packages/core/src/cards/compute/`. That is not a discipline problem: the
parity suite fails until both exist, and the generated corpus proves they agree.

**The `sequence` field kind** (see `schema.py`) is the tool for any card where a turn is
an ordered chain rather than a tally. Comet needs it because its 4–5 branch deals damage
equal to loyalty *at that moment*, so an earlier +2 roll makes a later damage roll bigger
— per-outcome counters would lose exactly the information that matters. Reach for it
whenever "what order did these happen in?" changes the result.

## 1. Commander tax (format mechanic, not a single card)

Each time your commander has been cast from the command zone, it costs {2} more the next
time, cumulatively. Constantly recalculated at the table, especially once cost-reduction
effects stack on top.

**Proposed fields**: `base_commander_cost` (number — commander's mana value),
`times_cast_from_command_zone` (counter — "cast commander" button), `flat_cost_reduction`
(number, default 0).
**Proposed outputs**: `current_cast_cost` = max(0, base_commander_cost + 2 ×
times_cast_from_command_zone − flat_cost_reduction).

This one's a judgment call on scope: it isn't a "card", so it stretches the plugin
system's "one card = one module" framing slightly — `CardMetadata.rules_text`/`name`
would describe a rule instead of a card. Worth deciding deliberately if/when it gets
built, rather than by accident.

## Choosing bounds

A `FieldSpec`'s `min`/`max` is **a promise about what the UI has to survive**, not just
input validation. Pick the smallest number still beyond any real game, not the largest
that fits in an int.

The rule: past **a million** of anything — power, life, damage, tokens — the exact figure
has stopped mattering and you have simply won. `backend/tests/test_practical_bounds.py`
enforces that by feeding every card its declared maxima and checking the answer stays
readable, so this is a build failure rather than a convention.

Watch for bounds that get amplified. Craterhoof *squares* its creature count into the
total, and Scute Swarm *doubles* per land drop — both shipped with generous-looking
input caps that produced two million and 6.3×10⁵⁰ respectively.

## Adding a card

1. Write `backend/app/cards/<card>.py` exporting `METADATA: CardMetadata` and
   `compute(inputs) -> dict`. Match the idiom of an existing module closely: module
   docstring naming the card *and its wrinkle*, `MAX_*` constants instead of inline
   literals, `short_label` on every field and output, exactly one `primary=True` output,
   and comments that explain the table situation rather than the code.
2. Add it to both the import list and `_MODULES` in `registry.py` (alphabetical).
3. Write `backend/tests/test_<card>.py` with a local `_inputs(**overrides)` helper.
   Coverage is enforced at 100% branch, so every branch of `compute()` needs a case,
   including a `test_compute_at_upper_bound`.

4. Mirror `compute()` in `packages/core/src/cards/compute/<card-id>.ts` and register it
   in `packages/core/src/cards/registry.ts`. The parity suite fails until you do — the
   registry-completeness check compares the TypeScript registry against the backend's.
5. Regenerate: `cd backend && uv run python tools/generate_parity_corpus.py`. CI's
   `--check` fails if you forget, and the corpus is what proves the two agree.

No UI changes are needed unless the card requires a new `FieldKind`.
