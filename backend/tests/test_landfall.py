"""Landfall: the roster is data, so these cover the shapes rather than every card --
the flat case, several sources at once, duplicate copies, the second-resolution rider,
sources with no number attached, and the forecast before any land has dropped."""

from typing import Any

from app.cards.effects import TOTAL_TEMPLATES
from app.cards.landfall import _SOURCES, METADATA, compute

BASE: dict[str, Any] = {
    "sources": [],
    "triggers_per_land": 1,
    "lands_this_turn": 0,
    "mana_pool": [],
}


def run(**overrides: Any) -> dict[str, Any]:
    return compute({**BASE, **overrides})


def line(outputs: dict[str, Any], source: str) -> dict[str, str]:
    return next(row for row in outputs["effects"] if row["source"] == source)


def test_an_empty_board_has_nothing_to_say() -> None:
    outputs = run()
    assert outputs == {
        "effects": [],
        "triggers": 0,
        "cards_drawn": 0,
        "life_gained": 0,
        "damage_each_opponent": 0,
        "tokens_created": 0,
    }


def test_before_a_land_drops_the_roster_reads_as_a_forecast() -> None:
    # The screen is worth looking at while deciding whether to crack a fetch, so a
    # roster with no lands yet says what *will* happen rather than "0 mana".
    outputs = run(sources=["lotus-cobra"])
    assert line(outputs, "Lotus Cobra") == {
        "source": "Lotus Cobra",
        "effect": "Add one mana of any color",
        "note": "on your next land",
    }
    assert outputs["triggers"] == 0


def test_the_mana_pool_is_state_the_player_owns() -> None:
    # The pool is not reconciled against what the triggers produced: compute() cannot
    # tell mana you spent from mana you never assigned. It is simply where the Cobra
    # mana goes once you have picked a colour, and the effect line says how much.
    outputs = run(sources=["lotus-cobra"], lands_this_turn=2, mana_pool=["G", "U"])
    assert line(outputs, "Lotus Cobra")["note"] == "2 mana"


def test_the_user_example_three_permanents_one_land() -> None:
    # Lotus Cobra + Tatyova + Tannuk, one land: three separate abilities, three lines.
    outputs = run(
        sources=["lotus-cobra", "tatyova-benthic-druid", "tannuk-memorial-ensign"],
        lands_this_turn=1,
    )
    assert [row["effect"] for row in outputs["effects"]] == [
        "Add one mana of any color",
        "Gain 1 life and draw a card",
        "1 damage to each opponent (2nd resolution also draws)",
    ]
    assert outputs["triggers"] == 3
    assert outputs["cards_drawn"] == 1
    assert outputs["life_gained"] == 1
    assert outputs["damage_each_opponent"] == 1


def test_totals_accumulate_over_a_multi_land_turn() -> None:
    # Three lands with Tatyova out: 3 cards and 3 life, said once in her own line.
    # Note order follows _TOTAL_TEMPLATES, not the source's own declaration order, so
    # two sources contributing the same categories always read the same way round.
    outputs = run(sources=["tatyova-benthic-druid"], lands_this_turn=3)
    assert line(outputs, "Tatyova, Benthic Druid")["note"] == "3 cards · 3 life"
    assert outputs["cards_drawn"] == 3
    assert outputs["life_gained"] == 3


def test_a_doubler_multiplies_every_source() -> None:
    # Ancient Greenwarden: two triggers per land, so two lands is four resolutions.
    outputs = run(sources=["rampaging-baloths"], lands_this_turn=2, triggers_per_land=2)
    assert outputs["tokens_created"] == 4
    assert line(outputs, "Rampaging Baloths")["note"] == "4 tokens"


def test_two_copies_are_two_abilities_on_one_line() -> None:
    # A second Lotus Cobra is a second ability, not a bigger one -- collapsed to one
    # line so the readout does not repeat itself, with the count carried in the label.
    outputs = run(sources=["lotus-cobra", "lotus-cobra"], lands_this_turn=2)
    assert len(outputs["effects"]) == 1
    assert line(outputs, "Lotus Cobra x2")["note"] == "4 mana"
    # Triggers counts abilities on the stack, so both copies count.
    assert outputs["triggers"] == 4


def test_the_second_resolution_rider_waits_for_the_second_land() -> None:
    one_land = run(sources=["tannuk-memorial-ensign"], lands_this_turn=1)
    assert one_land["cards_drawn"] == 0
    assert "2nd resolution" not in line(one_land, "Tannuk, Memorial Ensign")["note"]

    two_lands = run(sources=["tannuk-memorial-ensign"], lands_this_turn=2)
    assert two_lands["cards_drawn"] == 1
    assert (
        line(two_lands, "Tannuk, Memorial Ensign")["note"]
        == "1 card · 2 damage to each opponent · 2nd resolution drew a card"
    )


def test_the_rider_fires_once_per_copy_not_once_per_land() -> None:
    # Four lands, two Tannuks: each ability's *second* resolution draws, so two cards
    # total -- not four. This is the arithmetic the card invites you to get wrong.
    outputs = run(sources=["tannuk-memorial-ensign", "tannuk-memorial-ensign"], lands_this_turn=4)
    assert outputs["cards_drawn"] == 2
    assert outputs["damage_each_opponent"] == 8


def test_a_rider_with_no_number_still_shows_in_the_note() -> None:
    outputs = run(sources=["scythecat-cub"], lands_this_turn=2)
    assert line(outputs, "Scythecat Cub")["note"] == (
        "2 counters · 2nd resolution doubled that creature's counters instead"
    )


def test_a_source_with_no_countable_output_still_gets_a_line() -> None:
    # Proliferating is a real effect with no number; the line says how many times.
    outputs = run(sources=["evolution-sage"], lands_this_turn=3)
    assert line(outputs, "Evolution Sage")["note"] == "x3"
    assert outputs["tokens_created"] == 0


def test_damage_and_mill_stack_across_different_sources() -> None:
    outputs = run(
        sources=["tannuk-memorial-ensign", "tunneling-geopede", "sabotender"],
        lands_this_turn=3,
    )
    # Three damage sources, three lands: each opponent has taken nine.
    assert outputs["damage_each_opponent"] == 9


def test_singular_and_plural_read_correctly() -> None:
    one = run(sources=["rampaging-baloths"], lands_this_turn=1)
    assert line(one, "Rampaging Baloths")["note"] == "1 token"
    two = run(sources=["rampaging-baloths"], lands_this_turn=2)
    assert line(two, "Rampaging Baloths")["note"] == "2 tokens"


def test_compute_at_upper_bound() -> None:
    # The declared ceiling: a full roster of twelve, the maximum doubler, 99 lands.
    roster = list(_SOURCES)[:12]
    outputs = run(sources=roster, triggers_per_land=4, lands_this_turn=99)
    assert outputs["triggers"] == 99 * 4 * 12
    assert len(outputs["effects"]) == 12
    # Every line still renders a note rather than falling off the end of the templates.
    assert all(row["note"] for row in outputs["effects"])


def test_every_roster_option_maps_to_a_source() -> None:
    # The options are generated from _SOURCES, so this guards a hand-edit that added an
    # option without the data behind it -- compute() would KeyError at the table.
    field = next(field for field in METADATA.fields if field.name == "sources")
    assert field.options is not None
    assert [option.value for option in field.options] == list(_SOURCES)


def test_every_source_declares_known_total_categories() -> None:
    # A typo'd category would silently vanish from every note and every aggregate.
    for source_id, source in _SOURCES.items():
        for category, _amount in (*source.totals, *source.rider_totals):
            assert category in TOTAL_TEMPLATES, f"{source_id} uses unknown total {category}"


def test_every_source_with_rider_totals_declares_a_rider() -> None:
    # Rider totals only ever apply when the rider text fires, so totals without text
    # would be silently unreachable arithmetic.
    for source_id, source in _SOURCES.items():
        if source.rider_totals:
            assert source.rider is not None, f"{source_id} has rider totals but no rider"
