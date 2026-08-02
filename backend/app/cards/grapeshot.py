"""Grapeshot: 1 damage per resolution, once for the original spell and once for each
storm copy -- so the total scales with spells cast *before* it this turn, by anyone at
the table, not just the caster."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec
from .storm import total_copies

DAMAGE_PER_COPY = 1
MAX_STORM_COUNT = 99

METADATA = CardMetadata(
    id="grapeshot",
    name="Grapeshot",
    rules_text=(
        "Grapeshot deals 1 damage to any target. Storm (When you cast this spell, copy "
        "it for each spell cast before it this turn. You may choose new targets for the "
        "copies.)"
    ),
    fields=[
        FieldSpec(
            name="storm_count",
            label="Spells cast before this one this turn",
            short_label="storm",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_STORM_COUNT,
            action_label="Spell cast before this",
            help_text="Spells cast by *any* player this turn, not just you. Countered spells "
            "and spells cast from a graveyard or exile still count; the copies storm itself "
            "makes are not cast, so they never count.",
        ),
    ],
    outputs=[
        OutputSpec(name="copies_from_storm", label="Copies from storm", short_label="copies"),
        OutputSpec(name="total_copies", label="Total resolutions", short_label="resolutions"),
        OutputSpec(
            name="total_damage",
            label="Total damage",
            short_label="damage",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    storm_count = int(inputs["storm_count"])

    resolutions = total_copies(storm_count)

    return {
        "copies_from_storm": storm_count,
        "total_copies": resolutions,
        "total_damage": resolutions * DAMAGE_PER_COPY,
    }
