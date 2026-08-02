# Future card ideas

Candidates for the next cards to add to the plugin registry (`backend/app/cards/`). None
of these are implemented yet — this is a working spec so whoever picks one up next
(us, later) doesn't have to re-derive the math or re-verify the Oracle text from scratch.
All Oracle text below was verified against Scryfall/Gatherer/MTG Salvation search results
on 2026-07-29 (re-checked 2026-07-31), not pulled from memory alone — do the same sanity
check before implementing, since this is exactly the kind of detail that's easy to
misremember (see: the "before it" vs. "this turn" mixup we caught in Aetherflux Reservoir's
actual first implementation).

Craterhoof Behemoth (formerly listed here) is now implemented —
`backend/app/cards/craterhoof_behemoth.py`. Its multi-trigger design (independent creature
counts per trigger resolution, since board state can change between them) is worth reading
if a similarly-shaped "X = count of Y" one-shot multiplier card comes up again.

Commander (EDH) relevance was the filter for all of these, per the user's ask to focus there
first. Ranked roughly by how well they fit the site's pattern (few simple inputs, one clear
derived answer, no general game-state tracking) and how well-known/iconic they are at the
Commander table.

## 1. Storm count calculator — anchor card: Grapeshot

> Grapeshot deals 1 damage to any target. Storm (When you cast this spell, copy it for
> each spell cast **before** it this turn. You may choose new targets for the copies.)

Storm count is arguably *the* iconic "annoying math" trigger in Magic, and a natural sibling
to Aetherflux Reservoir (both are spell-count payoffs, but storm counts strictly *before* the
triggering spell, not inclusive of it — unlike Aetherflux's actual "this turn, inclusive" wording).

**Status (2026-07-31): design ideas only, not built yet.** Less table experience with storm on
the user's side than the other cards here, so this one is deliberately not locked. Two "funky
rules" details worth designing around up front, since getting these wrong is exactly the kind
of mistake that already happened once (Aetherflux's "before it" vs. "this turn" mixup):
- Storm count is spells cast by **all** players this turn, before this one — not just yours.
  Easy to misremember as "your spells"; whatever field ships needs to say so in its label or
  `help_text`.
- Countered spells and spells cast from graveyard/exile still count toward storm; the copies
  storm itself creates are *not cast* and don't count toward a later storm spell the same turn.

**Proposed shape**: a small shared helper, `backend/app/cards/storm.py`, exporting one pure
function — `total_copies(storm_count: int) -> int: return storm_count + 1` — unit-tested on
its own, imported by `grapeshot.py` and any future storm card (Tendrils of Agony — life gain
instead of damage; Brain Freeze — mill; Empty the Warrens — tokens). Each storm card's own
`compute()` stays specific to that card's per-copy effect; the shared piece is only the
"+1 for the original spell, copies aren't cast" logic — not a speculative generic "storm card"
abstraction that only one card would ever use. Mirrors `validation.py`'s role: a shared
non-card helper module, not a registered card itself.

Concrete field/output names intentionally not finalized — revisit once the storm-count
questions above have been thought through further.

## 2. Nykthos, Shrine to Nyx

> {T}: Add {C}. {2}, {T}: Choose a color. Add an amount of mana of that color equal to your
> devotion to that color. (Devotion to a color = the number of mana symbols of that color in
> the mana costs of permanents you control.)

A different flavor of annoying: the "math" here is really just an accurate *tally*, not a
derived formula — the tedious part is scanning your whole board and counting pips without
missing one. Fits the existing `counter` field kind as-is with no schema changes: a "found a
pip" +1 button plays the same role "cast a spell" does for Aetherflux.

**Proposed fields**: `devotion_count` (counter — click once per colored mana symbol found).
**Proposed outputs**: `mana_produced` = devotion_count, `net_mana_after_activation_cost` =
devotion_count − 2 (the activated ability itself costs {2}, so this answers "was it worth
tapping Nykthos for" at a glance).

## 3. Scute Swarm

> Landfall — Whenever a land you control enters, create a 1/1 green Insect creature token.
> **If you control six or more lands, create a token that's a copy of this creature instead.**

Threshold-gated exponential growth: swarm count stays flat (Insects pile up 1-for-1) below
6 lands, then doubles every land drop at 6+ lands. Worth building specifically *because* it's
a different computational shape than the others — needs an actual step-by-step simulation
across land drops (checking the 6-land gate at each step), not a closed-form sum. Good
architecture showcase, and it's a well-known "exponential bugs" build-around at the table.

**Proposed fields**: `current_land_count` (number, default matches whatever's realistic to
start from), `scute_swarm_count` (number, default 1), `insect_token_count` (number, default 0),
`lands_played` (counter — "play a land" button, same interaction pattern as Aetherflux's
"cast a spell").
**Proposed outputs**: `final_land_count`, `final_scute_swarm_count`, `final_insect_count`,
`total_power` = final_scute_swarm_count + final_insect_count (everything's a 1/1).
**Compute sketch**: starting from `current_land_count`/`scute_swarm_count`/`insect_token_count`,
loop `lands_played` times; each iteration increments land count by 1, then if the new land
count ≥ 6, doubles the swarm count, else adds the current swarm count to the insect count.

## 4. Aristocrat mass-drain — anchor card: Blood Artist

> Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.

Comes up constantly after a board wipe in aristocrats decks, especially once a player is
running more than one drain-on-death effect (Zulaport Cutthroat, Cruel Celebrant, etc.) —
easy to lose track of the total swing when multiplying creatures-died × effects-controlled
in your head mid-combo.

**Proposed fields**: `creatures_died` (number — how many creatures died this event),
`drain_effect_count` (number, default 1 — how many Blood-Artist-style triggers you control).
**Proposed outputs**: `total_life_drained` = creatures_died × drain_effect_count (equals both
total life lost by the target(s) and total life you gain, since the gain side isn't targeted).

## 5. Commander tax (format mechanic, not a single card)

Not tied to one card — it's a Commander-specific rule, which is worth calling out since the
user asked to focus on Commander first: each time your commander would go anywhere from the
battlefield except to the graveyard/exile as a state-based action... more precisely, each time
it's been cast from the command zone, it costs {2} more the next time, cumulative. Constantly
recalculated at the table, especially once cost-reduction effects are stacked on top.

**Proposed fields**: `base_commander_cost` (number — commander's mana value),
`times_cast_from_command_zone` (counter — "cast commander" button), `flat_cost_reduction`
(number, default 0).
**Proposed outputs**: `current_cast_cost` = max(0, base_commander_cost + 2 × times_cast_from_command_zone
− flat_cost_reduction).

This one's a judgment call on scope: it's not a "card," so it stretches the plugin system's
"one card = one module" framing slightly (the `CardMetadata.rules_text`/`name` fields would
describe a rule instead of a card). Worth deciding deliberately if/when we build it, rather
than by accident.

## 6. Comet, Stellar Pup

> {2}{R}{W} Legendary Planeswalker — Comet. Starting loyalty 5.
> 0: Roll a six-sided die.
> 1 or 2 — [+2], then create two 1/1 green Squirrel creature tokens. They gain haste until end
> of turn.
> 3 — [−1], then return a card with mana value 2 or less from your graveyard to your hand.
> 4 or 5 — Comet deals damage equal to the number of loyalty counters on him to a creature or
> player, then [−2].
> 6 — [+1], and you may activate Comet's loyalty ability two more times this turn.

User-suggested (played it 2026-08-01, called it "a perfect candidate for being tracked by
this app"). Oracle text above pulled via web search from Scryfall (Unfinity #166) on
2026-08-01 — verify again before implementing, per this doc's usual rule.

**Heads-up on scope**: Comet is from Unfinity (silver-bordered/"Un-set"), which is not
tournament-legal and not Commander-legal under the default banlist — it's only in play at
tables that have explicitly opted in (as the user's apparently has). Worth a one-line note in
the card's `rules_text` or a short disclaimer if this ships, so it's not mistaken for a
standard-legal Commander card.

Shaped differently from every other card here: one loyalty ability with **four die-roll
branches**, only one of which (4 or 5) has real "annoying math" (damage scales with current
loyalty, which the player is simultaneously spending down via the same activation — easy to
get the order of operations wrong live at the table: the damage amount is loyalty *before* the
[−2], not after). The other three branches (token creation, graveyard return, bonus
activations) are just loyalty bookkeeping, not calculator-worthy on their own.

**Proposed fields**: `current_loyalty` (number, default 5, setup — ticks up/down turn to turn
same as any planeswalker), `roll_result` (select: `1-2`, `3`, `4-5`, `6` — the physical die
roll already happened, so this just tells compute() which branch resolved).
**Proposed outputs**: `damage_dealt` (loyalty before the −2, only when `roll_result` is `4-5`;
0 otherwise), `loyalty_after` (loyalty after applying the branch's own loyalty change:
+2 / −1 / −2 / +1 respectively, clamped at 0 same as any planeswalker dying to 0 loyalty).
**Open question**: whether "you may activate two more times this turn" (the 6 result) is worth
modeling as a repeat-roll loop in the UI, or left as a note the player handles by pressing the
button again — leaning toward the latter (keeps the card a single loyalty-ability calculator,
not a mini state machine) but not decided.

## Suggested priority

Storm count (Grapeshot) is next up, once the open design questions in its section above are
resolved. Scute Swarm is a good pick after that specifically because its math shape
(threshold-gated simulation) is genuinely different from the closed-form/single-formula cards
above it.
