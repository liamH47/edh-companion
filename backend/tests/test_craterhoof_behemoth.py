from app.cards.craterhoof_behemoth import MAX_CREATURE_COUNT, MAX_TRIGGERS, compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "total_power_before_triggers": 0,
        "creature_count": 0,
        "triggers": 1,
        "creatures_added_per_trigger": 1,
    }
    base.update(overrides)
    return base


def test_compute_returns_zero_bonus_with_no_creatures() -> None:
    result = compute(_inputs())
    assert result["power_added"] == 0
    assert result["total_power_after_triggers"] == 0


def test_compute_applies_the_squared_bonus_for_a_single_trigger() -> None:
    result = compute(_inputs(total_power_before_triggers=10, creature_count=5))
    assert result["power_added"] == 25  # 5*5
    assert result["total_power_after_triggers"] == 35  # 10 + 25
    # One trigger, so each creature simply got +5/+5.
    assert result["pump_per_creature"] == 5
    assert result["last_trigger_bonus"] == 5


def test_a_later_trigger_counts_the_body_that_caused_it() -> None:
    # Two triggers at 4 creatures, the second because another Hoof entered: that Hoof
    # counts itself, so the second X is 5, not 4.
    result = compute(_inputs(total_power_before_triggers=8, creature_count=4, triggers=2))
    assert result["last_trigger_bonus"] == 5
    assert result["power_added"] == 41  # 4*4 + 5*5
    assert result["total_power_after_triggers"] == 49  # 8 + 41
    # A creature present for both triggers gained 4 then 5.
    assert result["pump_per_creature"] == 9


def test_a_flicker_leaves_the_count_unchanged() -> None:
    # The same creature leaves and returns, so nothing was added: both triggers see 4.
    result = compute(_inputs(creature_count=4, triggers=2, creatures_added_per_trigger=0))
    assert result["power_added"] == 32  # 4*4 twice
    assert result["pump_per_creature"] == 8
    assert result["last_trigger_bonus"] == 4


def test_the_added_count_is_ignored_when_there_is_only_one_trigger() -> None:
    # Nothing comes "before a later trigger" if there is no later trigger.
    with_growth = compute(_inputs(creature_count=6, creatures_added_per_trigger=20))
    without = compute(_inputs(creature_count=6, creatures_added_per_trigger=0))
    assert with_growth == without


def test_triggers_past_two_keep_compounding() -> None:
    # The cap of two was the arbitrary part: a fourth trigger is the same arithmetic.
    result = compute(_inputs(creature_count=3, triggers=4))
    # X of 3, 4, 5, 6.
    assert result["power_added"] == 9 + 16 + 25 + 36
    assert result["pump_per_creature"] == 18
    assert result["last_trigger_bonus"] == 6


def test_compute_handles_craterhoof_alone_with_no_other_creatures() -> None:
    # Craterhoof itself is a 5-power creature and counts itself once its own trigger
    # resolves -- both total_power_before_triggers and creature_count reflect that.
    result = compute(_inputs(total_power_before_triggers=5, creature_count=1))
    assert result["total_power_after_triggers"] == 6


def test_compute_at_upper_bound() -> None:
    result = compute(
        _inputs(
            total_power_before_triggers=9_999,
            creature_count=MAX_CREATURE_COUNT,
            triggers=MAX_TRIGGERS,
            creatures_added_per_trigger=20,
        )
    )
    expected = sum((99 + step * 20) ** 2 for step in range(MAX_TRIGGERS))
    assert result["power_added"] == expected
    assert result["total_power_after_triggers"] == 9_999 + expected
    # Still a number a player can read, which is what the bounds promise.
    assert result["total_power_after_triggers"] < 1_000_000
