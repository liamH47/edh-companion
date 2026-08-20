"""Commander tax: not a card but a format rule, and the one people recompute out loud at
the table every time the commander gets removed again. Each cast from the command zone
adds {2}, cumulatively, and cost-reduction effects stack on top -- so "what does it cost
*now*?" is a moving target worth a calculator.

There is no card behind this, so `scryfall_id` is None and no "View card" image renders.
The registry's scryfall-id check allowlists it explicitly (see test_registry.py)."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

TAX_PER_PRIOR_CAST = 2
MAX_BASE_COST = 20
MAX_PRIOR_CASTS = 30
MAX_REDUCTION = 20

METADATA = CardMetadata(
    id="commander-tax",
    name="Commander Tax",
    # No scryfall_id: this is rule 903.8, not a card. rules_text describes the rule.
    # The cast count is game-long -- "New turn" has no meaning here and would
    # quietly erase it (the resetTurn bug the dungeons review surfaced).
    resets_on_new_turn=False,
    rules_text=(
        "Each time you cast your commander from the command zone, it costs {2} more for "
        "each previous time you've cast it from the command zone this game."
    ),
    fields=[
        FieldSpec(
            name="base_commander_cost",
            label="Commander's mana value",
            short_label="base cost",
            kind=FieldKind.NUMBER,
            default=4,
            min=0,
            max=MAX_BASE_COST,
            help_text="Your commander's printed total mana value, before any tax or reduction.",
            setup=True,
        ),
        FieldSpec(
            name="flat_cost_reduction",
            label="Cost reduction you control",
            short_label="reduction",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_REDUCTION,
            help_text="Total generic reduction from effects you control "
            "(Jodah, Emerald Medallion, ...). Applied to the whole cost, never below zero.",
        ),
        FieldSpec(
            name="times_cast_from_command_zone",
            label="Times already cast from the command zone",
            short_label="prior casts",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_PRIOR_CASTS,
            action_label="Cast from command zone",
            help_text="How many times you've already cast your commander from the command "
            "zone this game -- tap once each time you cast it. The next cast is taxed on this.",
        ),
    ],
    outputs=[
        OutputSpec(name="commander_tax", label="Commander tax", short_label="tax"),
        OutputSpec(
            name="current_cast_cost",
            label="Next cast costs",
            short_label="next cost",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    base = int(inputs["base_commander_cost"])
    prior_casts = int(inputs["times_cast_from_command_zone"])
    reduction = int(inputs["flat_cost_reduction"])

    tax = TAX_PER_PRIOR_CAST * prior_casts
    # Reductions apply to the whole cost and can't drive it below zero. This treats every
    # part of the cost as generic -- the practical simplification a table actually wants,
    # rather than tracking which coloured pips a reduction may not touch.
    current_cast_cost = max(0, base + tax - reduction)

    return {
        "commander_tax": tax,
        "current_cast_cost": current_cast_cost,
    }
