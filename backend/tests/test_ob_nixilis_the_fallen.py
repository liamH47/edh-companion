from app.cards.ob_nixilis_the_fallen import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "existing_counters": 0,
        "triggers_per_land": 1,
        "lands_this_turn": 0,
    }
    base.update(overrides)
    return base


def test_compute_reports_a_bare_three_three_before_any_landfall() -> None:
    result = compute(_inputs())
    assert result["power"] == 3
    assert result["life_drained"] == 0


def test_compute_grows_three_counters_and_drains_three_per_land() -> None:
    result = compute(_inputs(lands_this_turn=1))
    assert result["counters_added"] == 3
    assert result["power"] == 6
    assert result["life_drained"] == 3


def test_compute_accumulates_across_multiple_lands_in_a_turn() -> None:
    # Three land drops (Azusa, say) is the whole reason this card needs a calculator.
    result = compute(_inputs(lands_this_turn=3))
    assert result["landfall_triggers"] == 3
    assert result["counters_added"] == 9
    assert result["power"] == 12
    assert result["life_drained"] == 9


def test_compute_builds_on_counters_from_earlier_turns() -> None:
    result = compute(_inputs(existing_counters=6, lands_this_turn=1))
    assert result["total_counters"] == 9
    assert result["power"] == 12
    # Only this turn's triggers drained; the older counters came from earlier drains.
    assert result["life_drained"] == 3


def test_compute_doubles_triggers_with_a_landfall_doubler() -> None:
    # Ancient Greenwarden: each land entering triggers landfall an additional time.
    result = compute(_inputs(lands_this_turn=2, triggers_per_land=2))
    assert result["landfall_triggers"] == 4
    assert result["counters_added"] == 12
    assert result["power"] == 15
    assert result["life_drained"] == 12


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(existing_counters=999, lands_this_turn=99, triggers_per_land=4))
    assert result["landfall_triggers"] == 396
    assert result["total_counters"] == 999 + 396 * 3
    assert result["power"] == 3 + 999 + 396 * 3
