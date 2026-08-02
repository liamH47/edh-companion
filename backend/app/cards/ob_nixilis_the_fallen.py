"""Ob Nixilis, the Fallen: every land you play drains 3 and makes him three counters
bigger -- so a turn with extra land drops (or a landfall doubler) swings both his size
and the table's life totals much further than it feels like it should."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

BASE_POWER = 3
COUNTERS_PER_TRIGGER = 3
LIFE_LOST_PER_TRIGGER = 3
MAX_EXISTING_COUNTERS = 999
MAX_LANDS_PER_TURN = 99
MAX_TRIGGERS_PER_LAND = 4

METADATA = CardMetadata(
    id="ob-nixilis-the-fallen",
    name="Ob Nixilis, the Fallen",
    rules_text=(
        "Landfall — Whenever a land you control enters, you may have target player lose 3 "
        "life. If you do, put three +1/+1 counters on Ob Nixilis, the Fallen."
    ),
    fields=[
        FieldSpec(
            name="existing_counters",
            label="+1/+1 counters already on him",
            short_label="counters",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_EXISTING_COUNTERS,
            help_text="From earlier turns. He's a 3/3 with none.",
            setup=True,
        ),
        FieldSpec(
            name="triggers_per_land",
            label="Landfall triggers per land",
            short_label="per land",
            kind=FieldKind.NUMBER,
            default=1,
            min=1,
            max=MAX_TRIGGERS_PER_LAND,
            help_text="1 normally. 2 with Ancient Greenwarden or another landfall doubler.",
            setup=True,
        ),
        FieldSpec(
            name="lands_this_turn",
            label="Lands entered this turn",
            short_label="lands",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_LANDS_PER_TURN,
            action_label="Land entered",
            help_text="Any land, not just Swamps, and not just your land drop for the turn. "
            "Assumes you take the drain every trigger -- declining one means no counters "
            "from it either.",
        ),
    ],
    outputs=[
        OutputSpec(name="power", label="Power and toughness", short_label="power", primary=True),
        OutputSpec(name="landfall_triggers", label="Landfall triggers", short_label="triggers"),
        OutputSpec(name="counters_added", label="Counters added this turn", short_label="added"),
        OutputSpec(name="total_counters", label="Total +1/+1 counters", short_label="counters"),
        OutputSpec(name="life_drained", label="Life drained this turn", short_label="drained"),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    existing_counters = int(inputs["existing_counters"])
    triggers_per_land = int(inputs["triggers_per_land"])
    lands_this_turn = int(inputs["lands_this_turn"])

    landfall_triggers = lands_this_turn * triggers_per_land
    counters_added = landfall_triggers * COUNTERS_PER_TRIGGER
    total_counters = existing_counters + counters_added

    return {
        # He's a 3/3 base and the counters are +1/+1, so power and toughness stay equal.
        "power": BASE_POWER + total_counters,
        "landfall_triggers": landfall_triggers,
        "counters_added": counters_added,
        "total_counters": total_counters,
        # Each trigger picks its own target, so this is the total drained across the
        # whole table -- not damage any single opponent necessarily took.
        "life_drained": landfall_triggers * LIFE_LOST_PER_TRIGGER,
    }
