from app.cards.grapeshot import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "storm_count": 0,
    }
    base.update(overrides)
    return base


def test_compute_deals_one_damage_with_no_storm_count() -> None:
    # The spell always resolves once on its own, even with nothing cast before it.
    result = compute(_inputs())
    assert result["total_copies"] == 1
    assert result["total_damage"] == 1


def test_compute_adds_one_damage_per_preceding_spell() -> None:
    result = compute(_inputs(storm_count=4))
    assert result["copies_from_storm"] == 4
    assert result["total_copies"] == 5
    assert result["total_damage"] == 5


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(storm_count=99))
    assert result["total_copies"] == 100
    assert result["total_damage"] == 100
