"""Scute Swarm: every Scute Swarm copy you control has its own landfall trigger, so a
single land drop fires once per copy -- a flat 1/1 Insect each below six lands, but a
full copy of Scute Swarm itself (which then has its own trigger too) at six or more.
That's the doubling: it isn't one card counting lands, it's an exponentially growing
number of copies each reacting to the same land drop."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

LANDFALL_THRESHOLD = 6
MAX_LAND_COUNT = 99
# Bounds are a promise the UI has to survive, so they are set to the smallest number
# still beyond any real game rather than the largest that fits in an int. The swarm
# doubles per land drop, so `lands_played` dominates: 12 land drops in one turn is
# already a dedicated loop, and 99 copies is a board nobody is counting by hand.
# Together they cap the answer near 400,000 -- past which the exact figure has stopped
# mattering and you have simply won.
MAX_SWARM_COUNT = 99
MAX_INSECT_COUNT = 999
MAX_LANDS_PLAYED = 12

METADATA = CardMetadata(
    id="scute-swarm",
    name="Scute Swarm",
    scryfall_id="ea630ba1-22f9-4a10-bdc6-0d03128214f4",
    rules_text=(
        "Landfall — Whenever a land you control enters, create a 1/1 green Insect "
        "creature token. If you control six or more lands, create a token that's a copy "
        "of this creature instead."
    ),
    fields=[
        FieldSpec(
            name="current_land_count",
            label="Lands you control right now",
            short_label="lands",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_LAND_COUNT,
            setup=True,
        ),
        FieldSpec(
            name="scute_swarm_count",
            label="Copies of Scute Swarm you control",
            short_label="swarm",
            kind=FieldKind.NUMBER,
            default=1,
            min=0,
            max=MAX_SWARM_COUNT,
            help_text="1 for Scute Swarm itself. Each copy has its own landfall trigger, "
            "which is why this doubles instead of staying flat once you hit six lands.",
            setup=True,
        ),
        FieldSpec(
            name="insect_token_count",
            label="1/1 Insect tokens you already control",
            short_label="insects",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_INSECT_COUNT,
            setup=True,
        ),
        FieldSpec(
            name="lands_played",
            label="Lands played this turn",
            short_label="played",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_LANDS_PLAYED,
            action_label="Land played",
            help_text="Each land triggers landfall once per Scute Swarm copy you control "
            "at that moment -- that's the doubling.",
        ),
    ],
    outputs=[
        OutputSpec(name="final_land_count", label="Lands after this turn", short_label="lands"),
        OutputSpec(
            name="final_scute_swarm_count",
            label="Scute Swarm copies after this turn",
            short_label="swarm",
        ),
        OutputSpec(
            name="final_insect_count",
            label="Insect tokens after this turn",
            short_label="insects",
        ),
        OutputSpec(
            name="total_power",
            label="Total power on board",
            short_label="power",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    land_count = int(inputs["current_land_count"])
    swarm_count = int(inputs["scute_swarm_count"])
    insect_count = int(inputs["insect_token_count"])
    lands_played = int(inputs["lands_played"])

    # Simulated step by step, not a closed-form sum -- the six-land gate can flip
    # mid-sequence, and each step's trigger count depends on the swarm count so far.
    for _ in range(lands_played):
        land_count += 1
        if land_count >= LANDFALL_THRESHOLD:
            swarm_count *= 2
        else:
            insect_count += swarm_count

    return {
        "final_land_count": land_count,
        "final_scute_swarm_count": swarm_count,
        "final_insect_count": insect_count,
        # Everything on board from this card is a 1/1, so power == body count.
        "total_power": swarm_count + insect_count,
    }
