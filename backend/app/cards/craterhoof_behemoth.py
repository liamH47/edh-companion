"""Craterhoof Behemoth: creatures you control get +X/+X (and trample) until end of
turn, where X is your creature count -- recalculated independently each time this
kind of trigger resolves, since the board can change between them."""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec, VisibleIf

# Each trigger squares this into the total (X creatures each gaining +X/+X), so the
# cap is squared too. 99 creatures is already a board that has won without attacking.
MAX_CREATURE_COUNT = 99
MAX_TOTAL_POWER = 9_999
MAX_ADDITIONAL_TRIGGERS = 1

METADATA = CardMetadata(
    id="craterhoof-behemoth",
    name="Craterhoof Behemoth",
    scryfall_id="276f5cee-a501-4658-bd4d-7a044bf1ccbc",
    show_hero_art=True,
    rules_text=(
        "Haste. When this creature enters, creatures you control gain trample and get "
        "+X/+X until end of turn, where X is the number of creatures you control."
    ),
    fields=[
        FieldSpec(
            name="total_power_before_triggers",
            label="Total power of your creatures before any trigger resolves",
            short_label="power before",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_TOTAL_POWER,
            setup=True,
        ),
        FieldSpec(
            name="trigger_1_creature_count",
            label="Creatures you control when the first trigger resolves",
            short_label="creatures (1st)",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_CREATURE_COUNT,
            help_text="Include Craterhoof itself -- it has haste and is already on the "
            "battlefield when its own trigger resolves.",
            setup=True,
        ),
        # Not `setup`: unlike the other fields here, this isn't board state answered once
        # up front -- it's whether a *second* trigger happens, which a player only learns
        # partway through the turn, so it stays live alongside trigger_2_creature_count.
        FieldSpec(
            name="additional_triggers",
            label="Second Craterhoof-shaped trigger this turn?",
            short_label="2nd trigger",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_ADDITIONAL_TRIGGERS,
            action_label="Additional Trigger",
            help_text="Only if a second trigger resolves this turn (a second copy, a "
            "flicker, a similar effect) -- most turns won't have one.",
        ),
        FieldSpec(
            name="trigger_2_creature_count",
            label="Creatures you control when the second trigger resolves",
            short_label="creatures (2nd)",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_CREATURE_COUNT,
            visible_if=VisibleIf(field="additional_triggers", equals=1),
            help_text="Re-confirm the count fresh -- it can differ from the first trigger.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="power_bonus_trigger_1",
            label="Power bonus per creature (trigger 1)",
            short_label="bonus (1st)",
        ),
        OutputSpec(
            name="power_after_trigger_1",
            label="Total power after trigger 1",
            short_label="after 1st",
        ),
        OutputSpec(
            name="power_bonus_trigger_2",
            label="Power bonus per creature (trigger 2)",
            short_label="bonus (2nd)",
        ),
        OutputSpec(
            name="total_power_after_triggers",
            label="Total power after all triggers",
            short_label="total power",
            primary=True,
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    total_power_before = int(inputs["total_power_before_triggers"])
    trigger_1_creature_count = int(inputs["trigger_1_creature_count"])
    trigger_2_creature_count = int(inputs["trigger_2_creature_count"])

    # Each trigger's X is squared into the total independently -- X creatures each
    # gaining +X power adds X*X to the sum, regardless of what any other trigger did.
    power_after_trigger_1 = total_power_before + trigger_1_creature_count**2
    power_after_trigger_2 = power_after_trigger_1 + trigger_2_creature_count**2

    return {
        "power_bonus_trigger_1": trigger_1_creature_count,
        "power_after_trigger_1": power_after_trigger_1,
        "power_bonus_trigger_2": trigger_2_creature_count,
        "total_power_after_triggers": power_after_trigger_2,
    }
