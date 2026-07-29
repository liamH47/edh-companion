# Future card ideas

Candidates for the next cards to add to the plugin registry (`backend/app/cards/`). None
of these are implemented yet — this is a working spec so whoever picks one up next
(us, later) doesn't have to re-derive the math or re-verify the Oracle text from scratch.
All Oracle text below was verified against Scryfall/Gatherer/MTG Salvation search results
on 2026-07-29, not pulled from memory alone — do the same sanity check before implementing,
since this is exactly the kind of detail that's easy to misremember (see: the "before it"
vs. "this turn" mixup we caught in Aetherflux Reservoir's actual first implementation).

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

**Proposed fields**: `storm_count` (number — spells cast before this one this turn),
`damage_per_copy` (number, default 1 — lets the same shape cover similar storm finishers later
if we ever add them as separate cards, e.g. Tendrils of Agony's life drain).
**Proposed outputs**: `total_copies` = storm_count + 1 (the original spell plus one copy per
spell before it), `total_damage` = total_copies × damage_per_copy.

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

## 3. Craterhoof Behemoth

> Haste. When this creature enters, creatures you control gain trample and get +X/+X until
> end of turn, where X is the number of creatures you control.

The classic "am I lethal this turn" combat-math moment in green decks. Different shape from
Aetherflux/storm (a one-shot multiplier, not an accumulating trigger), so it exercises a
different kind of `compute()`.

**Proposed fields**: `creature_count` (number — how many creatures you control, including
Craterhoof itself once it's on the battlefield), `total_power_before_buff` (number — sum of
your creatures' power before the trigger resolves; this tally is the actually tedious part).
**Proposed outputs**: `power_bonus_per_creature` = creature_count, `total_power_after_buff` =
total_power_before_buff + creature_count². (Each of the N creatures gains +N power, so the
sum increases by N².) Assumes an unblocked/trample-through attack for the "total damage" read.

## 4. Scute Swarm

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

## 5. Aristocrat mass-drain — anchor card: Blood Artist

> Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.

Comes up constantly after a board wipe in aristocrats decks, especially once a player is
running more than one drain-on-death effect (Zulaport Cutthroat, Cruel Celebrant, etc.) —
easy to lose track of the total swing when multiplying creatures-died × effects-controlled
in your head mid-combo.

**Proposed fields**: `creatures_died` (number — how many creatures died this event),
`drain_effect_count` (number, default 1 — how many Blood-Artist-style triggers you control).
**Proposed outputs**: `total_life_drained` = creatures_died × drain_effect_count (equals both
total life lost by the target(s) and total life you gain, since the gain side isn't targeted).

## 6. Commander tax (format mechanic, not a single card)

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

## Suggested priority

Storm count (Grapeshot) and Craterhoof Behemoth are the strongest next picks — both are very
well-known and each exercises the pattern cleanly. Scute Swarm is a good pick after that
specifically because its math shape (threshold-gated simulation) is genuinely different from
the closed-form/single-formula cards above it.
