"""Tendrils of Agony: drain two per resolution, once for the original spell and once
for each storm copy -- the classic storm kill, where a storm count of 9 drains exactly
20 and ends the game from a full life total.

Unlike Grapeshot's damage, this is life *loss*, so it goes through damage prevention
and protection alike; and the gain half isn't targeted, so the controller always gains
the full amount even if the copies are spread across several opponents.
"""

from typing import Any

from .schema import AlertSpec, CardMetadata, FieldKind, FieldSpec, OutputSpec
from .storm import total_copies

LIFE_PER_COPY = 2
MAX_STORM_COUNT = 99
MAX_TARGET_LIFE = 999
STARTING_COMMANDER_LIFE = 40

METADATA = CardMetadata(
    id="tendrils-of-agony",
    name="Tendrils of Agony",
    rules_text=(
        "Target player loses 2 life and you gain 2 life. Storm (When you cast this "
        "spell, copy it for each spell cast before it this turn. You may choose new "
        "targets for the copies.)"
    ),
    fields=[
        FieldSpec(
            name="target_life",
            label="Life total you're aiming at",
            short_label="their life",
            kind=FieldKind.NUMBER,
            default=STARTING_COMMANDER_LIFE,
            min=0,
            max=MAX_TARGET_LIFE,
            help_text="40 is a fresh Commander life total -- lower it to whatever they're "
            "actually on.",
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
            name="life_drained",
            label="Life drained",
            short_label="drained",
            primary=True,
        ),
        OutputSpec(name="life_gained", label="Life you gain", short_label="you gain"),
        OutputSpec(name="target_life_after", label="Life they're left on", short_label="they end"),
    ],
    alert=AlertSpec(output="is_lethal", message="That kills them"),
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    storm_count = int(inputs["storm_count"])
    target_life = int(inputs["target_life"])

    resolutions = total_copies(storm_count)
    # Only lands entirely on one player if every copy keeps the same target -- copies
    # may each be redirected, which is exactly why this is worth showing separately
    # from the life gained.
    life_drained = resolutions * LIFE_PER_COPY

    return {
        "copies_from_storm": storm_count,
        "total_copies": resolutions,
        "life_drained": life_drained,
        # The gain half doesn't target, so the controller banks the full amount however
        # the losses were spread around the table.
        "life_gained": life_drained,
        "target_life_after": max(0, target_life - life_drained),
        "is_lethal": life_drained >= target_life,
    }
