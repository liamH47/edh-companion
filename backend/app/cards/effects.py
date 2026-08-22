"""Effect-line assembly, shared by the roster cards.

Not a registered card -- the same supporting role `storm.py` and `validation.py` play.

Landfall and Storm ask the same question in the same shape: several sources, one
repeated event, and a readout saying what each source produced. Only two things differ
per card -- which sources exist, and how the event count is derived. Everything here is
the part that would otherwise be copied into the second card and drift out of step with
the first.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

# How each total is phrased, and the order phrases appear in a note. Keeping the order
# here rather than at the call site means two sources contributing the same categories
# always read the same way round, on every card that uses this.
TOTAL_TEMPLATES: dict[str, str] = {
    "mana": "{n} mana",
    "cards": "{n} card{s}",
    "life": "{n} life",
    "damage_each": "{n} damage to each opponent",
    "damage_one": "{n} damage",
    "life_loss": "{n} life lost",
    "tokens": "{n} token{s}",
    "counters": "{n} counter{s}",
    "mill_self": "{n} milled",
    "mill_one": "{n} milled by a player",
    "mill_each": "{n} milled by each opponent",
}


@dataclass(frozen=True)
class Source:
    """One permanent or spell in a roster: what it does per resolution, and what that
    totals to.

    `totals` is per resolution, in the categories `TOTAL_TEMPLATES` knows how to phrase.
    A source with none is not an oversight -- proliferating, countering a spell or taking
    an extra combat is a real effect with no number attached, and the line still has to
    appear. Those rows say how many times instead.
    """

    label: str
    scryfall_id: str
    effect: str
    totals: tuple[tuple[str, int], ...] = ()
    # Fires once per copy when the per-ability count reaches the card's threshold, never
    # again. Magic's "if this is the second time this ability has resolved this turn".
    rider: str | None = None
    rider_totals: tuple[tuple[str, int], ...] = ()


def phrase(category: str, amount: int) -> str:
    return TOTAL_TEMPLATES[category].format(n=amount, s="" if amount == 1 else "s")


def _note(totals: dict[str, int], resolutions: int, rider_fired: str | None) -> str:
    parts = [
        phrase(category, totals[category])
        for category in TOTAL_TEMPLATES
        if totals.get(category, 0) != 0
    ]
    # A source with no countable output still needs to say it happened.
    if not parts:
        parts = [f"x{resolutions}"]
    if rider_fired is not None:
        parts.append(rider_fired)
    return " · ".join(parts)


def build_lines(
    sources: Mapping[str, Source],
    picked: Sequence[str],
    per_ability: int,
    *,
    rider_threshold: int | None = None,
    forecast_note: str | None = None,
) -> tuple[list[dict[str, str]], dict[str, int]]:
    """One effect line per distinct source, plus the totals rolled up across all of them.

    `per_ability` is how many times a *single* one of these resolves. A second copy of a
    card is a second ability, not a bigger one -- which is why duplicates collapse into
    one line carrying a count, and why a rider fires per copy rather than once for the
    whole roster.

    `forecast_note` replaces the totals before the event has happened at all, so a roster
    with nothing resolved yet reads as what *will* happen rather than a column of zeroes.
    Cards where the event has always happened at least once (a storm spell always
    resolves) pass None and never see it.
    """
    copies: dict[str, int] = {}
    for source_id in picked:
        copies[source_id] = copies.get(source_id, 0) + 1

    lines: list[dict[str, str]] = []
    aggregate: dict[str, int] = {}

    for source_id, count in copies.items():
        source = sources[source_id]
        resolutions = per_ability * count

        totals: dict[str, int] = {
            category: amount * resolutions for category, amount in source.totals
        }
        rider_fired = (
            source.rider if rider_threshold is not None and per_ability >= rider_threshold else None
        )
        if rider_fired is not None:
            for category, amount in source.rider_totals:
                totals[category] = totals.get(category, 0) + amount * count

        for category, amount in totals.items():
            aggregate[category] = aggregate.get(category, 0) + amount

        note = (
            forecast_note
            if resolutions == 0 and forecast_note is not None
            else _note(totals, resolutions, rider_fired)
        )
        lines.append(
            {
                "source": source.label if count == 1 else f"{source.label} x{count}",
                "effect": source.effect,
                "note": note,
            }
        )

    return lines, aggregate
