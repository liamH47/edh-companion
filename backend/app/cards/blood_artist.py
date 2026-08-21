"""Blood Artist: each creature death drains 1 life per Blood-Artist-style trigger you
control -- easy to lose track of once a board wipe kills several creatures at once and
more than one drain-on-death effect is stacked on top."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

MAX_CREATURES_DIED = 99
MAX_DRAIN_EFFECT_COUNT = 20

METADATA = CardMetadata(
    id="blood-artist",
    name="Blood Artist",
    scryfall_id="b5275d76-2947-4219-be21-614c7421614a",
    show_hero_art=True,
    rules_text=(
        "Whenever this creature or another creature dies, target player loses 1 life and "
        "you gain 1 life."
    ),
    fields=[
        FieldSpec(
            name="drain_effect_count",
            label="Blood-Artist-style triggers you control",
            short_label="triggers",
            kind=FieldKind.NUMBER,
            default=1,
            min=0,
            max=MAX_DRAIN_EFFECT_COUNT,
            help_text="Count Blood Artist itself plus any other death-drain trigger you "
            "control (Zulaport Cutthroat, Cruel Celebrant, ...).",
            setup=True,
        ),
        FieldSpec(
            name="creatures_died",
            label="Creatures that died this event",
            short_label="died",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_CREATURES_DIED,
            help_text="However many died at once -- a board wipe, a combat trade, a single "
            "removal spell.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="total_life_drained",
            label="Life drained (and gained)",
            short_label="drained",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    creatures_died = int(inputs["creatures_died"])
    drain_effect_count = int(inputs["drain_effect_count"])

    return {
        # Equals both total life lost by the target(s) and total life gained -- the
        # gain side isn't targeted, so it always lands entirely on the controller.
        "total_life_drained": creatures_died * drain_effect_count,
    }
