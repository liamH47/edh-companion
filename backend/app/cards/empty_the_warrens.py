"""Empty the Warrens: two Goblins per resolution, once for the original spell and once
for each storm copy -- so a modest storm count still empties into a board that wins on
its own a turn later.

Unlike the other storm cards here, this one doesn't target, so its reminder text has no
"you may choose new targets" clause and every resolution lands the same way.
"""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec
from .storm import total_copies

GOBLINS_PER_COPY = 2
GOBLIN_POWER = 1
MAX_STORM_COUNT = 99

METADATA = CardMetadata(
    id="empty-the-warrens",
    name="Empty the Warrens",
    scryfall_id="939d765a-aefb-4393-8808-98b1bbd7e803",
    rules_text=(
        "Create two 1/1 red Goblin creature tokens. Storm (When you cast this spell, "
        "copy it for each spell cast before it this turn.)"
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
            help_text="Spells cast by every player this turn, not just you. Countered spells "
            "and spells cast from a graveyard or exile still count; the copies storm itself "
            "makes are not cast, so they never count.",
        ),
    ],
    outputs=[
        OutputSpec(name="copies_from_storm", label="Copies from storm", short_label="copies"),
        OutputSpec(name="total_copies", label="Total resolutions", short_label="resolutions"),
        OutputSpec(
            name="goblins_created",
            label="Goblins created",
            short_label="goblins",
            primary=True,
        ),
        OutputSpec(
            name="damage_next_turn",
            label="Damage if they all attack",
            short_label="next turn",
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    storm_count = int(inputs["storm_count"])

    resolutions = total_copies(storm_count)
    goblins_created = resolutions * GOBLINS_PER_COPY

    return {
        "copies_from_storm": storm_count,
        "total_copies": resolutions,
        "goblins_created": goblins_created,
        # They enter without haste, so this is next turn's number, not this turn's --
        # which is the whole reason the count matters when you cast it.
        "damage_next_turn": goblins_created * GOBLIN_POWER,
    }
