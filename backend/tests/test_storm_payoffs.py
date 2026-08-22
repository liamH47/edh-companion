"""Storm as a roster: the copy count is `storm.py`'s job and tested there, so these
cover what the category adds -- comparing payoffs at one count, and the shapes the
shared effect-line builder has to handle."""

from typing import Any

from app.cards.effects import TOTAL_TEMPLATES
from app.cards.storm_payoffs import _SOURCES, METADATA, compute

BASE: dict[str, Any] = {"payoffs": [], "storm_count": 0}


def run(**overrides: Any) -> dict[str, Any]:
    return compute({**BASE, **overrides})


def line(outputs: dict[str, Any], source: str) -> dict[str, str]:
    return next(row for row in outputs["effects"] if row["source"] == source)


def test_an_empty_hand_still_reports_the_storm_math() -> None:
    # The count is worth showing before you have anything to spend it on.
    outputs = run(storm_count=5)
    assert outputs == {
        "effects": [],
        "copies_from_storm": 5,
        "total_copies": 6,
        "damage_dealt": 0,
        "tokens_created": 0,
    }


def test_a_lone_payoff_resolves_copies_plus_the_original() -> None:
    # Storm 9 means 9 copies and the original: 10 Grapeshot triggers, 10 damage.
    outputs = run(payoffs=["grapeshot"], storm_count=9)
    assert outputs["total_copies"] == 10
    assert line(outputs, "Grapeshot")["note"] == "10 damage"
    assert outputs["damage_dealt"] == 10


def test_a_storm_spell_resolves_once_at_zero() -> None:
    # No forecast state here, unlike landfall: the spell still resolves once.
    outputs = run(payoffs=["grapeshot"], storm_count=0)
    assert outputs["total_copies"] == 1
    assert line(outputs, "Grapeshot")["note"] == "1 damage"


def test_two_payoffs_are_compared_at_the_same_count() -> None:
    # The question the screen exists for: at storm 9, which one wins?
    outputs = run(payoffs=["grapeshot", "tendrils-of-agony"], storm_count=9)
    assert line(outputs, "Grapeshot")["note"] == "10 damage"
    # Tendrils drains 2 a resolution and gains it back, so both halves are shown.
    assert line(outputs, "Tendrils of Agony")["note"] == "20 life · 20 life lost"


def test_two_copies_of_a_payoff_are_two_spells() -> None:
    outputs = run(payoffs=["empty-the-warrens", "empty-the-warrens"], storm_count=3)
    assert len(outputs["effects"]) == 1
    # Two Goblins a resolution, four resolutions, two copies of the card in hand.
    assert line(outputs, "Empty the Warrens x2")["note"] == "16 tokens"
    assert outputs["tokens_created"] == 16


def test_a_payoff_with_no_countable_effect_still_gets_a_line() -> None:
    # Countering four spells is a real outcome with no number to add up.
    outputs = run(payoffs=["flusterstorm"], storm_count=3)
    assert line(outputs, "Flusterstorm")["note"] == "x4"
    assert outputs["damage_dealt"] == 0


def test_damage_rolls_up_across_payoffs() -> None:
    outputs = run(payoffs=["grapeshot", "scattershot"], storm_count=4)
    assert outputs["damage_dealt"] == 10


def test_compute_at_upper_bound() -> None:
    roster = list(_SOURCES)[:8]
    outputs = run(payoffs=roster, storm_count=99)
    assert outputs["total_copies"] == 100
    assert len(outputs["effects"]) == 8
    assert all(row["note"] for row in outputs["effects"])


def test_every_payoff_option_maps_to_a_source() -> None:
    field = next(field for field in METADATA.fields if field.name == "payoffs")
    assert field.options is not None
    assert [option.value for option in field.options] == list(_SOURCES)


def test_every_source_declares_known_total_categories() -> None:
    for source_id, source in _SOURCES.items():
        for category, _amount in (*source.totals, *source.rider_totals):
            assert category in TOTAL_TEMPLATES, f"{source_id} uses unknown total {category}"


def test_no_payoff_declares_a_rider() -> None:
    # Storm has no "second time this resolves" wording anywhere -- that is landfall's
    # wrinkle. A rider here would silently never fire, since compute() passes no
    # threshold.
    assert not [source_id for source_id, source in _SOURCES.items() if source.rider]
