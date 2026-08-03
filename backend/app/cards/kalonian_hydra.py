"""Kalonian Hydra: every attack doubles the +1/+1 counters on each creature you
control -- not just the Hydra, and not the creatures' printed power.

Two things make this worth a calculator. It compounds: a second combat phase doubles an
already-doubled board, so the growth is geometric rather than additive. And only the
counter-derived half of your power moves -- a 6/6 with no counters on it contributes six
power that never changes, while a 0/0 Hydra under four counters doubles every swing.
Splitting "total power" from "total counters" is the whole point of the two inputs; a
single power field would silently double the wrong number.
"""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

MAX_TOTAL_POWER = 9_999
MAX_COUNTERS = 999
# Each attack doubles, so this is the exponent -- 999 counters through six attacks is
# already 63,936. Chaining more than six combats in one turn means you have gone
# infinite, at which point the exact number has stopped mattering.
MAX_ATTACKS = 6

METADATA = CardMetadata(
    id="kalonian-hydra",
    name="Kalonian Hydra",
    rules_text=(
        "Trample\n"
        "This creature enters with four +1/+1 counters on it.\n"
        "Whenever this creature attacks, double the number of +1/+1 counters on each "
        "creature you control."
    ),
    fields=[
        FieldSpec(
            name="total_power_before",
            label="Total power of your creatures before attacking",
            short_label="power before",
            kind=FieldKind.NUMBER,
            default=4,
            min=0,
            max=MAX_TOTAL_POWER,
            help_text="Include the Hydra itself. It is a 0/0, so its four counters are "
            "what make it a 4/4.",
            setup=True,
        ),
        FieldSpec(
            name="counters_before",
            label="Total +1/+1 counters on your creatures before attacking",
            short_label="counters before",
            kind=FieldKind.NUMBER,
            default=4,
            min=0,
            max=MAX_COUNTERS,
            help_text="Count +1/+1 counters only, across every creature you control. A "
            "creature with no counters gains nothing when the trigger resolves, however "
            "big it already is.",
            setup=True,
        ),
        FieldSpec(
            name="attacks_this_turn",
            label="Times the Hydra has attacked this turn",
            short_label="attacks",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_ATTACKS,
            action_label="Hydra Attacks",
            help_text="One per attack trigger that resolves. More than one means extra "
            "combat phases -- each doubles a board that is already doubled.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="counters_after",
            label="Total +1/+1 counters after attacking",
            short_label="counters",
        ),
        OutputSpec(
            name="power_gained",
            label="Power added by doubling",
            short_label="power gained",
        ),
        OutputSpec(
            name="total_power_after",
            label="Total power after attacking",
            short_label="total power",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    total_power_before = int(inputs["total_power_before"])
    counters_before = int(inputs["counters_before"])
    attacks_this_turn = int(inputs["attacks_this_turn"])

    # Doubling every creature's counters doubles the total, so N attacks multiply the
    # pool by 2**N. Each new counter is +1/+1, so the power gained is exactly the
    # number of counters added -- printed power rides along unchanged.
    counters_after = counters_before * 2**attacks_this_turn
    power_gained = counters_after - counters_before

    return {
        "counters_after": counters_after,
        "power_gained": power_gained,
        "total_power_after": total_power_before + power_gained,
    }
