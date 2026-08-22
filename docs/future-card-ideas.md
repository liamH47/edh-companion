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
| Craterhoof Behemoth | `craterhoof_behemoth.py` | "X = count of Y" resolved independently per trigger and summed over any number of triggers, since the board changes between them |
| Brain Freeze | `brain_freeze.py` | First storm card; shares `storm.py` |
| Grapeshot | `grapeshot.py` | Second storm card — near-trivial once `storm.py` existed |
| Ob Nixilis, the Fallen | `ob_nixilis_the_fallen.py` | Landfall grow-and-drain, with a trigger-doubler multiplier |
| Comet, Stellar Pup | `comet_stellar_pup.py` | The `sequence` field kind: an **ordered** log where order changes the answer |
| Nykthos, Shrine to Nyx | `nykthos_shrine_to_nyx.py` | A pure tally, where the tedium is counting, not computing. The minimal module to copy when adding a card |
| Scute Swarm | `scute_swarm.py` | Threshold-gated simulation that can't be a closed-form sum |
| Tendrils of Agony | `tendrils_of_agony.py` | Third storm card — a drain, with a lethal alert |
| Empty the Warrens | `empty_the_warrens.py` | Fourth storm card — tokens |
| Kalonian Hydra | `kalonian_hydra.py` | Geometric compounding: a repeatable trigger that doubles a board-wide aggregate, where only part of the total participates |
| Commander Tax | `commander_tax.py` | First cardless format mechanic: `scryfall_id=None`, allowlisted in `test_registry.py` |
| Dungeons | `dungeons.py` | The `map` capability on a sequence: a walk through a room graph, rendered as a tappable dungeon map, legality validated on both sides; also the first `resets_on_new_turn=False` game-long tracker |
| Mana Pool | `mana_pool.py` | The `mana` capability on a sequence: a multiset of colour letters rendered as tappable discs. State rather than arithmetic — the first entry whose value is what you are holding, not what you computed |
| Landfall | `landfall.py` | First entry whose subject is an *interaction between* cards rather than one card: a roster of permanents (the `picker` capability on a sequence) and a `lines` output rendered as the `list` hero. The pattern to reuse for any "several things trigger at once" mechanic |
| Storm | `storm_payoffs.py` | The second roster, and the proof the shape generalizes: 34 storm cards against the four with their own screens, compared side by side at one count. Where landfall's roster is your board, storm's is your hand |

**`effects.py`** (with `cards/effects.ts` mirroring it) is the second shared non-card
helper, extracted when Storm arrived: `Source`, the total phrasings, and `build_lines`.
Adding a third roster is now a data table plus a `compute()` that says how its event count
is derived. Landfall's parity corpus was byte-identical across that extraction, which is
what the corpus is for.

## Removed

**Blood Artist** shipped and was deleted on 2026-08-22, and the reason is worth keeping:
its whole calculation was `deaths x drain triggers`, two small numbers a player already
has in front of them. It was argued in on *frequency* -- a board wipe with three drain
effects out is easy to fumble under pressure -- and that argument turned out not to
survive contact with a real table, because nobody reaches for a phone to do it. Frequency
does not rescue arithmetic that small. `.claude/agents/card-evaluator.md` carries the
same lesson so the next evaluation starts from it.

Nothing else has been removed. The four single-card storm screens and the two landfall
ones (Ob Nixilis, Scute Swarm) overlap their categories but each earns its place by
holding something the roster cannot: a threshold to compare against (Brain Freeze's
library, Tendrils' target life, each with its own alert), state accumulated across turns
(Ob Nixilis's counters and current power), or maths the roster model deliberately does
not express (Scute Swarm's exponential copies). Grapeshot and Empty the Warrens are the
two whose screens are pure subsets of the Storm category -- flagged here rather than
deleted, because the card picker searches names only, so removing them would make
searching "grapeshot" return nothing at all even though the app handles it inside Storm.
Teach the picker to search roster contents first.

**Landfall's roster is data, not code.** Each entry is a `_Source` row — label, Scryfall
id, effect phrasing, per-resolution totals, and an optional second-resolution rider — so
adding a card is one dict entry on each side and no new branches. Three deliberate
exclusions, each because including them would mean guessing:

- **Modal landfall** (Felidar Retreat, the Retreat cycle): "choose one" is a decision per
  resolution, so any total would be wrong half the time. Modelling it would need a
  per-resolution mode choice — a real feature, not a roster row.
- **Board-state-conditional** (Field of the Dead's seven differently-named lands, Avenger
  of Zendikar's Plant count): needs a board the app cannot see.
- **Scute Swarm past six lands**, whose copies compound exponentially. Its own screen does
  that arithmetic; the roster row states the flat case and points there.

A Scryfall survey run 2026-08-21 found **214** cards that trigger on a land entering (189
carrying the keyword, 25 wording it without). Roughly half have effects with no number
attached at all — proliferate, mill, goad, extra combats — which is why an effect line with
an empty `totals` is a first-class case rather than an oversight.

**`storm.py`** is a shared non-card helper (the same supporting role `validation.py`
plays), and it paid off exactly as predicted: Tendrils of Agony and Empty the Warrens
were each a `METADATA` block plus a one-line per-copy effect. Any future storm card is
the same.

Note that a card now needs **two** implementations — Python in `backend/app/cards/` and
TypeScript in `packages/core/src/cards/compute/`. That is not a discipline problem: the
parity suite fails until both exist, and the generated corpus proves they agree.

**Splitting an aggregate when only part of it participates** is what Kalonian Hydra adds.
Its trigger doubles +1/+1 counters, not power, so a 6/6 with no counters contributes six
power that never moves while a 0/0 Hydra under four counters doubles every swing. One
"total power" field would have doubled the wrong number. Whenever an effect keys off a
subset of what the player is tracking, ask whether that subset needs its own field.

**The `sequence` field kind** (see `schema.py`) is the tool for any card where a turn is
an ordered chain rather than a tally. Comet needs it because its 4–5 branch deals damage
equal to loyalty *at that moment*, so an earlier +2 roll makes a later damage roll bigger
— per-outcome counters would lose exactly the information that matters. Reach for it
whenever "what order did these happen in?" changes the result.

## 1. Commander tax — shipped

Moved to the shipped table above (`commander_tax.py`, PR #22). The scope judgment its
proposal flagged got decided: cardless format mechanics are a supported shape, recorded
in `docs/roadmap.md` and enforced by `test_registry.py`'s allowlist. Dungeons (also
shipped) is the second entry in that family.

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
