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

**`storm.py`** is a shared non-card helper (the same supporting role `validation.py`
plays). Tendrils of Agony (life) and Empty the Warrens (tokens) are now nearly free —
each is a `METADATA` block plus a one-line per-copy effect.

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

The frontend needs no changes at all unless the card requires a new `FieldKind`.
