"""Every card's declared bounds must keep its answers inside what a screen can show.

A `FieldSpec`'s `min`/`max` is not just input validation -- it is a promise about what
the UI has to survive. Nothing else checks that promise, and it is easy to break by
accident: Craterhoof squares its creature count into the total, and Scute Swarm doubles
per land drop, so a generous-looking input bound becomes an unreadable output.

The rule is that past a million of anything -- power, life, damage, tokens -- the exact
figure has stopped mattering and you have simply won. So bounds should be the smallest
number still beyond any real game, not the largest that fits in an int.
"""

from typing import Any

from app.cards.registry import get_card, list_cards
from app.cards.schema import CardMetadata, FieldKind, MapSpec
from app.cards.validation import validate_inputs

PRACTICAL_OUTPUT_CEILING = 1_000_000

# The hero number is one line on a phone. Grouped digits make "406,503" seven
# characters, and the smallest hero font stops being readable well before twenty.
MAX_RENDERED_WIDTH = 15


def _longest_walk(spec: MapSpec) -> list[str]:
    successors: dict[str, list[str]] = {}
    for edge in spec.edges:
        successors.setdefault(edge.source, []).append(edge.target)

    def walk(room: str) -> list[str]:
        nexts = successors.get(room, [])
        if not nexts:
            return [room]
        return [room, *max((walk(target) for target in nexts), key=len)]

    return walk(spec.entry)


def _maximal_inputs(card: CardMetadata) -> dict[str, Any]:
    """Every field pushed to whatever produces the largest answer."""
    inputs: dict[str, Any] = {}
    for field in card.fields:
        if field.kind in (FieldKind.NUMBER, FieldKind.COUNTER):
            inputs[field.name] = field.max if field.max is not None else field.default
        elif field.kind is FieldKind.BOOLEAN:
            # False is the maximising choice for the only boolean in play (Aetherflux's
            # "was it already out", which zeroes the baseline when true).
            inputs[field.name] = False
        elif field.kind is FieldKind.SEQUENCE:
            if field.map is not None:
                # A mapped sequence must be a legal walk, so its maximum is the longest
                # path through the graph, not max-many copies of one option.
                inputs[field.name] = _longest_walk(field.map)
            else:
                options = field.options or []
                inputs[field.name] = [options[-1].value] * int(field.max or 0)
        else:
            inputs[field.name] = (field.options or [])[0].value
    return inputs


def _numeric_outputs(outputs: dict[str, Any]) -> dict[str, int]:
    # bool is an int subclass in Python, so alert flags would otherwise count as 0/1.
    return {
        name: value
        for name, value in outputs.items()
        if isinstance(value, int) and not isinstance(value, bool)
    }


def test_no_card_can_produce_an_output_past_the_practical_ceiling() -> None:
    too_big: list[str] = []

    for card in list_cards():
        outputs = get_card(card.id).compute(validate_inputs(card.fields, _maximal_inputs(card)))
        for name, value in _numeric_outputs(outputs).items():
            if abs(value) > PRACTICAL_OUTPUT_CEILING:
                too_big.append(f"{card.id}.{name} = {value:,}")

    assert not too_big, (
        "These outputs exceed the practical ceiling at their declared bounds:\n  "
        + "\n  ".join(too_big)
        + "\n\nTighten the input bounds rather than raising the ceiling -- the point is "
        "that the exact number has stopped mattering, not that the screen should try "
        "harder to show it."
    )


def test_no_card_produces_a_number_too_wide_to_render() -> None:
    """The ceiling above is about meaning; this is about pixels.

    They are separate checks because a card could stay under a million and still render
    badly -- a large negative, say, where the minus sign and separators add width the
    raw value does not suggest.
    """
    too_wide: list[str] = []

    for card in list_cards():
        outputs = get_card(card.id).compute(validate_inputs(card.fields, _maximal_inputs(card)))
        for name, value in _numeric_outputs(outputs).items():
            rendered = f"{value:,}"
            if len(rendered) > MAX_RENDERED_WIDTH:
                too_wide.append(f"{card.id}.{name} renders as {rendered!r}")

    assert not too_wide, "These render too wide for the hero stat:\n  " + "\n  ".join(too_wide)


def test_the_ceiling_check_would_actually_catch_a_regression() -> None:
    """A guard that has only ever seen passing input proves nothing.

    Scute Swarm shipped with a 999,999,999 swarm cap and 99 land drops, which produced
    about 6.3e50. Re-running that configuration confirms the check above fails on it.
    """
    card = next(c for c in list_cards() if c.id == "scute-swarm")
    outputs = get_card("scute-swarm").compute(
        {
            "current_land_count": 6,
            "scute_swarm_count": 999_999_999,
            "insect_token_count": 0,
            "lands_played": 99,
        }
    )
    assert card is not None
    assert outputs["final_scute_swarm_count"] > PRACTICAL_OUTPUT_CEILING
