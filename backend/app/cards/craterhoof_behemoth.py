"""Craterhoof Behemoth: creatures you control get +X/+X (and trample) until end of
turn, where X is your creature count -- recalculated independently each time this kind
of trigger resolves, since the board can change between them.

The count is recalculated per trigger, and each trigger pumps *every* creature, so the
total added is the sum of X squared rather than one big multiplication. That is the part
worth a calculator: two triggers at 8 creatures is not 16 creatures' worth of power, it
is 64 + 81 once the second Hoof is itself on the battlefield.

Any number of triggers is allowed. An earlier version capped this at two, which was an
arbitrary line -- Helm of the Host, a flicker chain or a second copy can all push past
it, and the arithmetic does not care how many there are.

`creatures_added_per_trigger` is the one modelled assumption, and it exists because the
two common cases are exact: **1** when each extra trigger comes from another
Craterhoof-shaped body entering (that body is itself a creature, so it raises the count
for every later trigger), and **0** when the same creature is flickered and returns.
A board that changes in some other way between triggers is rarer than either.
"""

from typing import Any

from .schema import CardMetadata, FieldKind, FieldSpec, OutputSpec

# Each trigger squares this into the total (X creatures each gaining +X/+X), so the cap
# is squared too. 99 creatures is already a board that has won without attacking.
MAX_CREATURE_COUNT = 99
MAX_TOTAL_POWER = 9_999
# Six is past any real non-infinite line; a loop that goes truly infinite does not need
# a calculator. At the declared maxima this lands near 150,000 power -- large, still
# readable, and well inside the million past which the exact figure stops mattering.
MAX_TRIGGERS = 6
MAX_CREATURES_ADDED = 20

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
            name="creature_count",
            label="Creatures you control when the first trigger resolves",
            short_label="creatures",
            kind=FieldKind.NUMBER,
            default=0,
            min=0,
            max=MAX_CREATURE_COUNT,
            help_text="Include Craterhoof itself -- it has haste and is already on the "
            "battlefield when its own trigger resolves.",
            setup=True,
        ),
        # Not `setup`: unlike the board state above, this isn't answered once up front --
        # a player learns partway through the turn how many triggers they got.
        FieldSpec(
            name="triggers",
            label="Craterhoof-shaped triggers this turn",
            short_label="triggers",
            kind=FieldKind.COUNTER,
            default=1,
            min=1,
            max=MAX_TRIGGERS,
            action_label="Another trigger",
            help_text="Its own trigger is the first one. Add another for each further "
            "copy, flicker or similar effect that resolves this turn.",
        ),
        FieldSpec(
            name="creatures_added_per_trigger",
            label="Creatures gained before each later trigger",
            short_label="added each",
            kind=FieldKind.NUMBER,
            default=1,
            min=0,
            max=MAX_CREATURES_ADDED,
            help_text="1 when the extra trigger is another body entering -- it counts "
            "itself. 0 for a flicker, where the same creature comes back and the count "
            "is unchanged. Ignored entirely when there is only one trigger.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="total_power_after_triggers",
            label="Total power after all triggers",
            short_label="total power",
            primary=True,
        ),
        OutputSpec(name="power_added", label="Power added by the triggers", short_label="added"),
        OutputSpec(
            name="pump_per_creature",
            label="+X/+X each creature ended up with",
            short_label="each gets",
        ),
        OutputSpec(
            name="last_trigger_bonus",
            label="X on the final trigger",
            short_label="final X",
        ),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    total_power_before = int(inputs["total_power_before_triggers"])
    creature_count = int(inputs["creature_count"])
    triggers = int(inputs["triggers"])
    added_per_trigger = int(inputs["creatures_added_per_trigger"])

    # X for each trigger in turn. The first resolves against the board as it stands;
    # each later one against a board that has grown by `added_per_trigger`.
    bonuses = [creature_count + step * added_per_trigger for step in range(triggers)]

    # Each trigger's X is squared into the total independently -- X creatures each
    # gaining +X power adds X*X to the sum, regardless of what any other trigger did.
    power_added = sum(bonus**2 for bonus in bonuses)

    return {
        "total_power_after_triggers": total_power_before + power_added,
        "power_added": power_added,
        # Every trigger pumps every creature, so a creature present for all of them
        # gained the sum of the X values -- not the largest one.
        "pump_per_creature": sum(bonuses),
        "last_trigger_bonus": bonuses[-1],
    }
