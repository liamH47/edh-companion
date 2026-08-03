"""Nykthos, Shrine to Nyx: the activated ability produces mana equal to your devotion
to a chosen color -- an accurate tally, not a formula. The tedious part is scanning
your board for pips without missing one, not the arithmetic once you have the count."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

ACTIVATION_COST = 2
MAX_DEVOTION_COUNT = 99

METADATA = CardMetadata(
    id="nykthos-shrine-to-nyx",
    name="Nykthos, Shrine to Nyx",
    scryfall_id="834b27a0-dfd7-4f96-8cde-cacac4b24acc",
    rules_text=(
        "{T}: Add {C}. {2}, {T}: Choose a color. Add an amount of mana of that color "
        "equal to your devotion to that color. (Devotion to a color is the number of "
        "mana symbols of that color in the mana costs of permanents you control.)"
    ),
    fields=[
        FieldSpec(
            name="devotion_count",
            label="Devotion pips found",
            short_label="devotion",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_DEVOTION_COUNT,
            action_label="Found a pip",
            help_text="Click once per colored mana symbol in the mana costs of permanents "
            "you control, for the color you're about to choose.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="mana_produced",
            label="Mana produced",
            short_label="mana",
            primary=True,
        ),
        OutputSpec(
            name="net_mana_after_activation_cost",
            label="Net mana after paying {2} to activate",
            short_label="net",
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    devotion_count = int(inputs["devotion_count"])

    return {
        "mana_produced": devotion_count,
        # Can go negative -- that's the point: it answers "was tapping Nykthos worth it"
        # at a glance, and a negative number is a clear "no."
        "net_mana_after_activation_cost": devotion_count - ACTIVATION_COST,
    }
