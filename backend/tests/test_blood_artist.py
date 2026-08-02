from app.cards.blood_artist import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "drain_effect_count": 1,
        "creatures_died": 0,
    }
    base.update(overrides)
    return base


def test_compute_drains_nothing_when_no_creature_died() -> None:
    assert compute(_inputs())["total_life_drained"] == 0


def test_compute_drains_one_per_creature_with_a_single_trigger() -> None:
    assert compute(_inputs(creatures_died=4))["total_life_drained"] == 4


def test_compute_multiplies_by_every_drain_trigger_controlled() -> None:
    # The case the card exists for: a board wipe with Blood Artist plus two friends.
    assert compute(_inputs(creatures_died=6, drain_effect_count=3))["total_life_drained"] == 18


def test_compute_drains_nothing_with_no_drain_effects_left() -> None:
    # The Artist can die to the same wipe it would otherwise trigger from.
    assert compute(_inputs(creatures_died=5, drain_effect_count=0))["total_life_drained"] == 0


def test_compute_at_upper_bound() -> None:
    assert compute(_inputs(creatures_died=99, drain_effect_count=20))["total_life_drained"] == 1980
