"""Brain Freeze: mill three per resolution, once for the original spell and once for
each storm copy -- so the answer scales with spells cast *before* it this turn, by
anyone at the table, not just by you."""

from typing import Any

from .schema import AlertSpec, CardMetadata, FieldKind, FieldSpec, OutputSpec
from .storm import total_copies

CARDS_MILLED_PER_COPY = 3
MAX_STORM_COUNT = 99
MAX_LIBRARY_SIZE = 999
COMMANDER_DECK_SIZE = 99

METADATA = CardMetadata(
    id="brain-freeze",
    name="Brain Freeze",
    rules_text=(
        "Target player mills three cards. Storm (When you cast this spell, copy it for "
        "each spell cast before it this turn. You may choose new targets for the copies.)"
    ),
    fields=[
        FieldSpec(
            name="target_library_size",
            label="Cards left in the library you're targeting",
            short_label="library",
            kind=FieldKind.NUMBER,
            default=COMMANDER_DECK_SIZE,
            min=0,
            max=MAX_LIBRARY_SIZE,
            help_text="99 is a fresh Commander deck -- lower it to whatever they're actually "
            "down to.",
            setup=True,
        ),
        FieldSpec(
            name="storm_count",
            label="Spells cast before this one this turn",
            short_label="storm",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_STORM_COUNT,
            action_label="Spell cast before this",
            help_text="Spells cast by every player this turn, not just you. Countered spells "
            "and spells cast from a graveyard or exile still count; the copies storm itself "
            "makes are not cast, so they never count.",
        ),
    ],
    outputs=[
        OutputSpec(name="copies_from_storm", label="Copies from storm", short_label="copies"),
        OutputSpec(name="total_copies", label="Total resolutions", short_label="resolutions"),
        OutputSpec(
            name="cards_milled",
            label="Cards milled",
            short_label="milled",
            primary=True,
        ),
        OutputSpec(name="library_after", label="Cards left after", short_label="left"),
    ],
    alert=AlertSpec(output="mills_out", message="That mills them out"),
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    storm_count = int(inputs["storm_count"])
    library_size = int(inputs["target_library_size"])

    resolutions = total_copies(storm_count)
    # Every copy may be redirected to a different player, so this total only lands on
    # one library if the player keeps every copy pointed at the same target.
    cards_milled = resolutions * CARDS_MILLED_PER_COPY

    return {
        "copies_from_storm": storm_count,
        "total_copies": resolutions,
        "cards_milled": cards_milled,
        "library_after": max(0, library_size - cards_milled),
        # Emptying a library isn't itself lethal -- they lose the next time they'd
        # draw from it. Still the number everyone leans over the table to see.
        "mills_out": cards_milled >= library_size,
    }
