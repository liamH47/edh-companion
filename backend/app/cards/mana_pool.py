"""Mana pool: the floating mana nobody can hold in their head past about four.

Magic empties your pool at the end of every step and phase, which means the mana that
matters is short-lived and arrives in bursts -- three Treasures cracked, a Cabal Coffers
activation, six triggers off a single land drop. The failure is never the arithmetic. It
is that "I have seven, two of which are green" leaves your head the moment somebody asks
a question mid-turn, and the pool is emptied by a rule rather than by anything you did.

So this is state, not a calculation: what is floating, by color, with the total and the
colored/generic split it takes to answer "can I cast this". `Empty pool` is a first-class
button because emptying is something the *rules* do to you at every phase change, not an
undo.

Colorless is offered alongside the five colors because {C} is a real, distinct cost
symbol -- Eldrazi ask for it specifically, and mana that can only pay generic costs is
worth seeing apart from mana that can pay anything.
"""

from typing import Any

from .schema import (
    CardMetadata,
    FieldKind,
    FieldSpec,
    ManaSpec,
    OutputSpec,
    SelectOption,
)

MAX_FLOATING = 99

# W U B R G are the five colors; C is colorless mana, which pays generic costs and {C}
# costs but never a colored one. The order is Magic's own (WUBRG), which is the order
# every player already reads a mana cost in.
_COLORS: dict[str, str] = {
    "W": "White",
    "U": "Blue",
    "B": "Black",
    "R": "Red",
    "G": "Green",
    "C": "Colorless",
}

METADATA = CardMetadata(
    id="mana-pool",
    name="Mana Pool",
    # No scryfall_id: a rules concept, not a card. See test_registry.py's allowlist.
    rules_text=(
        "Your mana pool empties at the end of each step and phase. Mana of a color pays "
        "that color's costs or any generic cost; colorless mana pays {C} costs and "
        "generic costs, but never a colored one."
    ),
    fields=[
        FieldSpec(
            name="pool",
            label="Floating mana",
            short_label="pool",
            kind=FieldKind.SEQUENCE,
            default=[],
            max=MAX_FLOATING,
            mana=ManaSpec(),
            options=[SelectOption(value=symbol, label=label) for symbol, label in _COLORS.items()],
            help_text="Tap a symbol to add, minus to spend. The pool empties on its own "
            "at the end of every step and phase -- that is the rule, not a mistake, and "
            "Empty pool is how you tell the tracker it happened.",
        ),
    ],
    outputs=[
        OutputSpec(name="total", label="Floating mana", short_label="floating", primary=True),
        OutputSpec(name="colored", label="Colored mana", short_label="colored"),
        OutputSpec(name="colorless", label="Colorless mana", short_label="colorless"),
        OutputSpec(name="colors_available", label="Colors available", short_label="colors"),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    pool = [str(symbol) for symbol in inputs["pool"]]

    colorless = sum(1 for symbol in pool if symbol == "C")

    return {
        "total": len(pool),
        # The split that answers "can I cast this": colorless mana pays a generic cost
        # but can never stand in for a colored pip.
        "colored": len(pool) - colorless,
        "colorless": colorless,
        # How many *distinct* colors are floating -- the number that decides whether a
        # multicolored cost is payable at all.
        "colors_available": len({symbol for symbol in pool if symbol != "C"}),
    }
