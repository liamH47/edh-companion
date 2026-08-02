"""Aetherflux Reservoir: gain 1 life for each spell cast this turn (including the
one that triggered it), then optionally pay 50 life to deal 50 damage."""

from typing import Any

from .schema import (
    ActionGuard,
    AlertSpec,
    CardMetadata,
    FieldKind,
    FieldSpec,
    OutputSpec,
    VisibleIf,
)

MAX_SPELLS_PER_TURN = 99
MAX_STARTING_LIFE = 99_999
MAX_ACTIVATIONS_PER_TURN = 99
ACTIVATION_LIFE_COST = 50

METADATA = CardMetadata(
    id="aetherflux-reservoir",
    name="Aetherflux Reservoir",
    rules_text=(
        "Whenever you cast a spell, you gain 1 life for each spell you've cast this turn. "
        "Pay 50 life: Aetherflux Reservoir deals 50 damage to any target."
    ),
    fields=[
        FieldSpec(
            name="starting_life",
            label="Life total at the start of the turn",
            short_label="start life",
            kind=FieldKind.NUMBER,
            default=40,
            min=0,
            max=MAX_STARTING_LIFE,
            setup=True,
        ),
        FieldSpec(
            name="was_in_play_at_turn_start",
            label="In play at the start of the turn?",
            short_label="in play",
            kind=FieldKind.BOOLEAN,
            default=True,
            setup=True,
        ),
        FieldSpec(
            name="spells_already_cast",
            label="Spells already cast before it entered",
            short_label="spells before",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_SPELLS_PER_TURN,
            visible_if=VisibleIf(field="was_in_play_at_turn_start", equals=False),
            setup=True,
        ),
        FieldSpec(
            name="spells_cast_this_turn",
            label="Spells cast this turn",
            short_label="spells cast",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_SPELLS_PER_TURN,
            default_source="spells_already_cast",
        ),
        FieldSpec(
            name="activations_used",
            label="Activations used",
            short_label="activations",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_ACTIVATIONS_PER_TURN,
            action_label="Pay 50 Life",
            action_disabled_when=ActionGuard(output="current_life", less_than=ACTIVATION_LIFE_COST),
        ),
    ],
    outputs=[
        OutputSpec(
            name="life_this_spell", label="Life gained this spell", short_label="this spell"
        ),
        OutputSpec(name="total_life", label="Total life gained", short_label="life gained"),
        OutputSpec(name="current_life", label="Current life total", short_label="life"),
        OutputSpec(name="damage_dealt", label="Damage dealt", short_label="damage dealt"),
        OutputSpec(
            name="possible_activations", label="Activations available", short_label="activations"
        ),
        OutputSpec(
            name="damage_available",
            label="Damage available",
            short_label="damage",
            primary=True,
        ),
        OutputSpec(
            name="spells_until_next_activation",
            label="Spells until next activation",
            short_label="until next",
        ),
    ],
    alert=AlertSpec(output="game_lost", message="Oops, looks like you lose now"),
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    baseline = 0 if inputs["was_in_play_at_turn_start"] else int(inputs["spells_already_cast"])
    spells_cast_this_turn = int(inputs["spells_cast_this_turn"])
    starting_life = int(inputs["starting_life"])
    activations_used = int(inputs["activations_used"])

    # spells_cast_this_turn is the running total the player actually sees at the table
    # (e.g. "3" after 2 spells pre-dated the Reservoir and 1 more was cast since). Only
    # the portion cast since the Reservoir was in play generates any gain; clamp at 0 in
    # case someone lowers the total below the baseline they set (nothing to derive there).
    spells_cast_after = max(0, spells_cast_this_turn - baseline)

    # The Nth spell cast this turn (counting itself) gains N life, so the spells cast
    # since the Reservoir became active gain baseline+1, baseline+2, ..., baseline+Y life.
    total_life = spells_cast_after * baseline + spells_cast_after * (spells_cast_after + 1) // 2
    life_this_spell = baseline + spells_cast_after if spells_cast_after >= 1 else 0

    damage_dealt = activations_used * ACTIVATION_LIFE_COST
    current_life = starting_life + total_life - damage_dealt
    # Clamp before threshold math below: a player can (accidentally or hypothetically)
    # record more activations than they had life for, and current_life can go negative
    # to reflect that honestly, but "how many activations remain" bottoms out at 0.
    effective_life = max(0, current_life)

    possible_activations = effective_life // ACTIVATION_LIFE_COST
    damage_available = possible_activations * ACTIVATION_LIFE_COST

    return {
        "life_this_spell": life_this_spell,
        "total_life": total_life,
        "current_life": current_life,
        "damage_dealt": damage_dealt,
        "possible_activations": possible_activations,
        "damage_available": damage_available,
        "spells_until_next_activation": _spells_until_next_activation(
            effective_life=effective_life,
            next_spell_gain=baseline + spells_cast_after + 1,
        ),
        # 0 or less life is a state-based loss (most commonly hit here by paying the
        # Reservoir's activation cost with exactly 50 life). Not in `outputs` above --
        # this drives a banner/sound in the frontend, not another number in the grid.
        "game_lost": current_life <= 0,
    }


def _spells_until_next_activation(*, effective_life: int, next_spell_gain: int) -> int:
    """How many more spells (cast with the Reservoir in play) until life crosses the
    next 50-life threshold -- i.e. affords one more activation than is possible now.

    Always terminates well within MAX_SPELLS_PER_TURN: life_needed is at most
    ACTIVATION_LIFE_COST (50), and cumulative gain after k spells is at least
    k*(k+1)/2 (starting from a next_spell_gain of 1), which clears 50 by k=10.
    """
    remainder = effective_life % ACTIVATION_LIFE_COST
    life_needed = ACTIVATION_LIFE_COST - remainder if remainder else ACTIVATION_LIFE_COST

    cumulative = 0
    gain = next_spell_gain
    spells_needed = 0
    while cumulative < life_needed:
        cumulative += gain
        gain += 1
        spells_needed += 1
    return spells_needed
