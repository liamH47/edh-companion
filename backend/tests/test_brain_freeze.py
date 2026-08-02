from app.cards.brain_freeze import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "target_library_size": 99,
        "storm_count": 0,
    }
    base.update(overrides)
    return base


def test_compute_mills_three_with_no_storm_count() -> None:
    # The spell always resolves once on its own, even with nothing cast before it.
    result = compute(_inputs())
    assert result["total_copies"] == 1
    assert result["cards_milled"] == 3


def test_compute_adds_three_more_per_preceding_spell() -> None:
    result = compute(_inputs(storm_count=4))
    assert result["copies_from_storm"] == 4
    assert result["total_copies"] == 5
    assert result["cards_milled"] == 15


def test_compute_subtracts_the_mill_from_the_target_library() -> None:
    result = compute(_inputs(storm_count=4, target_library_size=99))
    assert result["library_after"] == 84


def test_compute_clamps_the_library_at_zero_when_the_mill_overshoots() -> None:
    result = compute(_inputs(storm_count=20, target_library_size=10))
    assert result["cards_milled"] == 63
    assert result["library_after"] == 0


def test_compute_flags_milling_out_when_the_mill_exactly_empties_the_library() -> None:
    # 3 copies + the original = 4 resolutions = 12 cards, against a 12-card library.
    result = compute(_inputs(storm_count=3, target_library_size=12))
    assert result["cards_milled"] == 12
    assert result["mills_out"] is True


def test_compute_does_not_flag_milling_out_with_one_card_to_spare() -> None:
    result = compute(_inputs(storm_count=3, target_library_size=13))
    assert result["library_after"] == 1
    assert result["mills_out"] is False


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(storm_count=99, target_library_size=999))
    assert result["total_copies"] == 100
    assert result["cards_milled"] == 300
    assert result["library_after"] == 699
