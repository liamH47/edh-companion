"""Mana pool: state rather than arithmetic, so these cover the split that decides
whether a cost is payable -- coloured versus colorless, and how many distinct colours
are actually floating."""

from typing import Any

from app.cards.mana_pool import compute


def run(pool: list[str]) -> dict[str, Any]:
    return compute({"pool": pool})


def test_an_empty_pool_is_all_zeroes() -> None:
    assert run([]) == {"total": 0, "colored": 0, "colorless": 0, "colors_available": 0}


def test_one_of_each_colour() -> None:
    outputs = run(["W", "U", "B", "R", "G"])
    assert outputs["total"] == 5
    assert outputs["colored"] == 5
    assert outputs["colorless"] == 0
    assert outputs["colors_available"] == 5


def test_duplicates_count_toward_the_total_but_not_the_colour_spread() -> None:
    # Three green is three mana but one colour -- the distinction that decides whether
    # a two-colour cost is payable at all.
    outputs = run(["G", "G", "G"])
    assert outputs["total"] == 3
    assert outputs["colors_available"] == 1


def test_colorless_is_counted_apart_from_coloured() -> None:
    # Colorless pays generic costs and {C}, never a coloured pip, so it can never be
    # folded into the coloured total.
    outputs = run(["C", "C", "G"])
    assert outputs["total"] == 3
    assert outputs["colored"] == 1
    assert outputs["colorless"] == 2
    # And it is not a colour, so it never raises the spread.
    assert outputs["colors_available"] == 1


def test_a_purely_colorless_pool_has_no_colours() -> None:
    outputs = run(["C"])
    assert outputs["colored"] == 0
    assert outputs["colors_available"] == 0


def test_compute_at_upper_bound() -> None:
    outputs = run(["G"] * 99)
    assert outputs["total"] == 99
    assert outputs["colors_available"] == 1
