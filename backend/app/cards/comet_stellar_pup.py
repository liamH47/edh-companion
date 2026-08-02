"""Comet, Stellar Pup: one free activation a turn, but a 6 grants two more, so a turn
is an ordered *chain* of die rolls rather than a tally -- and the damage roll deals
loyalty-at-that-moment, which every earlier roll has already moved.

Unfinity is a silver-bordered set and isn't Commander-legal by default; this card only
comes up at tables that have explicitly opted in.
"""

from typing import Any

from .schema import (
    ActionGuard,
    AlertSpec,
    CardMetadata,
    FieldKind,
    FieldSpec,
    OutputSpec,
    RollSpec,
    SelectOption,
)

STARTING_LOYALTY = 5
MAX_LOYALTY = 999
MAX_ROLLS_PER_TURN = 40
SQUIRRELS_PER_ROLL = 2
BONUS_ACTIVATIONS_ON_SIX = 2
DAMAGE_ROLL_LOYALTY_COST = 2
DIE_FACES = 6

# The log stores the face actually rolled rather than the branch it falls into, so a
# turn reads back as "5, 2, 6" -- what happened at the table -- instead of "4-5, 1-2,
# 6". Grouping into branches is compute()'s job, below.
FACES_SQUIRRELS = frozenset({"1", "2"})
FACES_RETURN = frozenset({"3"})
FACES_DAMAGE = frozenset({"4", "5"})

METADATA = CardMetadata(
    id="comet-stellar-pup",
    name="Comet, Stellar Pup",
    rules_text=(
        "0: Roll a six-sided die. "
        "1 or 2 — [+2], then create two 1/1 green Squirrel creature tokens. They gain haste "
        "until end of turn. "
        "3 — [−1], then return a card with mana value 2 or less from your graveyard to your "
        "hand. "
        "4 or 5 — Comet deals damage equal to the number of loyalty counters on him to a "
        "creature or player, then [−2]. "
        "6 — [+1], and you may activate Comet's loyalty ability two more times this turn."
    ),
    fields=[
        FieldSpec(
            name="starting_loyalty",
            label="Loyalty before this turn's first activation",
            short_label="start loyalty",
            kind=FieldKind.NUMBER,
            default=STARTING_LOYALTY,
            min=0,
            max=MAX_LOYALTY,
            help_text="5 the turn he lands.",
            setup=True,
        ),
        FieldSpec(
            name="rolls",
            label="Rolls this turn",
            short_label="rolls",
            kind=FieldKind.SEQUENCE,
            default=[],
            max=MAX_ROLLS_PER_TURN,
            options=[
                SelectOption(value=str(face), label=str(face)) for face in range(1, DIE_FACES + 1)
            ],
            roll=RollSpec(faces=DIE_FACES, action_label="Roll the die"),
            action_disabled_when=ActionGuard(output="activations_remaining", less_than=1),
            help_text="1–2: +2 loyalty and two Squirrels. 3: −1 and return a card. "
            "4–5: deals damage equal to his loyalty, then −2. 6: +1 and two more activations.",
        ),
    ],
    outputs=[
        OutputSpec(name="loyalty", label="Loyalty", short_label="loyalty", primary=True),
        OutputSpec(
            name="activations_remaining",
            label="Activations remaining",
            short_label="acts left",
        ),
        OutputSpec(
            name="damage_this_activation",
            label="Damage from the last roll",
            short_label="dmg now",
        ),
        OutputSpec(name="total_damage", label="Total damage this turn", short_label="total dmg"),
        OutputSpec(name="squirrels_created", label="Squirrels created", short_label="squirrels"),
        OutputSpec(name="cards_returned", label="Cards returned", short_label="returned"),
    ],
    alert=AlertSpec(output="comet_died", message="Comet hit 0 loyalty and died"),
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    loyalty = int(inputs["starting_loyalty"])
    rolls = list(inputs["rolls"])

    # A planeswalker gets one loyalty activation a turn; every 6 rolled buys two more.
    activations_granted = 1
    damage_this_activation = 0
    total_damage = 0
    squirrels_created = 0
    cards_returned = 0
    died = False

    for roll in rolls:
        if died:
            # He's already in the graveyard -- anything logged after that never happened,
            # so stop rather than quietly compounding an impossible board state.
            break

        if roll in FACES_SQUIRRELS:
            loyalty += 2
            squirrels_created += SQUIRRELS_PER_ROLL
            damage_this_activation = 0
        elif roll in FACES_RETURN:
            loyalty = max(0, loyalty - 1)
            cards_returned += 1
            damage_this_activation = 0
        elif roll in FACES_DAMAGE:
            # The damage is loyalty *before* the -2: the ability deals damage first and
            # removes counters second. Resolving it the other way round is the single
            # easiest mistake to make with this card, and it costs 2 damage every time.
            damage_this_activation = loyalty
            total_damage += loyalty
            loyalty = max(0, loyalty - DAMAGE_ROLL_LOYALTY_COST)
        else:
            loyalty += 1
            activations_granted += BONUS_ACTIVATIONS_ON_SIX
            damage_this_activation = 0

        if loyalty <= 0:
            died = True

    return {
        "loyalty": loyalty,
        # Forced to 0 once he's dead so the roll buttons' guard disables them, rather
        # than offering activations of a permanent that's no longer on the battlefield.
        "activations_remaining": 0 if died else activations_granted - len(rolls),
        "damage_this_activation": damage_this_activation,
        "total_damage": total_damage,
        "squirrels_created": squirrels_created,
        "cards_returned": cards_returned,
        "comet_died": died,
    }
