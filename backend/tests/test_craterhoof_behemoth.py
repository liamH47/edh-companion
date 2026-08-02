from app.cards.craterhoof_behemoth import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "total_power_before_triggers": 0,
        "trigger_1_creature_count": 0,
        "trigger_2_creature_count": 0,
    }
    base.update(overrides)
    return base


def test_compute_returns_zero_bonus_when_no_triggers_have_resolved() -> None:
    result = compute(_inputs())
    assert result["power_after_trigger_1"] == 0
    assert result["total_power_after_triggers"] == 0


def test_compute_applies_the_squared_bonus_for_a_single_trigger() -> None:
    result = compute(_inputs(total_power_before_triggers=10, trigger_1_creature_count=5))
    assert result["power_after_trigger_1"] == 35  # 10 + 5*5
    assert result["total_power_after_triggers"] == 35


def test_compute_ignores_a_second_trigger_left_at_zero() -> None:
    result = compute(_inputs(total_power_before_triggers=10, trigger_1_creature_count=5))
    assert result["total_power_after_triggers"] == result["power_after_trigger_1"]


def test_compute_applies_both_triggers_independently_with_different_creature_counts() -> None:
    # Board state can change between triggers, so each trigger's count is its own input --
    # not derived from or shared with the other.
    result = compute(
        _inputs(
            total_power_before_triggers=8,
            trigger_1_creature_count=4,
            trigger_2_creature_count=6,
        )
    )
    assert result["power_after_trigger_1"] == 24  # 8 + 4*4
    assert result["total_power_after_triggers"] == 60  # 24 + 6*6


def test_compute_echoes_each_triggers_creature_count_as_its_own_power_bonus() -> None:
    result = compute(_inputs(trigger_1_creature_count=4, trigger_2_creature_count=6))
    assert result["power_bonus_trigger_1"] == 4
    assert result["power_bonus_trigger_2"] == 6


def test_compute_handles_craterhoof_alone_with_no_other_creatures() -> None:
    # Craterhoof itself is a 5-power creature and counts itself once its own trigger
    # resolves -- both total_power_before_triggers and trigger_1_creature_count reflect that.
    result = compute(_inputs(total_power_before_triggers=5, trigger_1_creature_count=1))
    assert result["power_after_trigger_1"] == 6
    assert result["total_power_after_triggers"] == 6


def test_compute_at_upper_bound() -> None:
    result = compute(
        _inputs(
            total_power_before_triggers=9_999,
            trigger_1_creature_count=999,
            trigger_2_creature_count=999,
        )
    )
    assert result["power_after_trigger_1"] == 9_999 + 999**2
    assert result["total_power_after_triggers"] == 9_999 + 2 * 999**2
