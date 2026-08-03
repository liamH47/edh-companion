from app.cards.kalonian_hydra import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "total_power_before": 4,
        "counters_before": 4,
        "attacks_this_turn": 0,
    }
    base.update(overrides)
    return base


def test_compute_leaves_the_board_alone_before_any_attack() -> None:
    result = compute(_inputs())
    assert result["counters_after"] == 4
    assert result["power_gained"] == 0
    assert result["total_power_after"] == 4


def test_compute_doubles_a_freshly_cast_hydra_on_its_first_attack() -> None:
    # A 0/0 under four counters is a 4/4; the trigger resolves before blockers, so it
    # is already an 8/8 when damage is assigned.
    result = compute(_inputs(attacks_this_turn=1))
    assert result["counters_after"] == 8
    assert result["power_gained"] == 4
    assert result["total_power_after"] == 8


def test_compute_compounds_across_extra_combats_rather_than_adding() -> None:
    # The distinction that matters at the table: three attacks are 4 -> 8 -> 16 -> 32,
    # not 4 + 4 + 4 + 4. Adding would give 16 and understate it by half.
    result = compute(_inputs(attacks_this_turn=3))
    assert result["counters_after"] == 32  # 4 * 2**3
    assert result["power_gained"] == 28
    assert result["total_power_after"] == 32


def test_compute_doubles_counters_across_the_whole_board_not_just_the_hydra() -> None:
    # Hydra (four counters) plus a teammate carrying six: ten counters double to twenty,
    # so the board gains ten power, not the four the Hydra alone would.
    result = compute(_inputs(total_power_before=10, counters_before=10, attacks_this_turn=1))
    assert result["counters_after"] == 20
    assert result["power_gained"] == 10
    assert result["total_power_after"] == 20


def test_compute_leaves_printed_power_untouched() -> None:
    # A 6/6 with no counters alongside the 4/4 Hydra: total power 10, but only the four
    # counters double. The 6/6 contributes six power that never moves.
    result = compute(_inputs(total_power_before=10, counters_before=4, attacks_this_turn=2))
    assert result["counters_after"] == 16  # 4 * 2**2
    assert result["power_gained"] == 12
    assert result["total_power_after"] == 22  # 10 printed-and-counter power + 12 gained


def test_compute_grows_nothing_when_no_counters_are_on_the_board() -> None:
    # Doubling zero is zero however many times you attack -- a board of vanilla
    # creatures gains nothing from the trigger.
    result = compute(_inputs(total_power_before=12, counters_before=0, attacks_this_turn=6))
    assert result["counters_after"] == 0
    assert result["power_gained"] == 0
    assert result["total_power_after"] == 12


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(total_power_before=9_999, counters_before=999, attacks_this_turn=6))
    assert result["counters_after"] == 63_936  # 999 * 2**6
    assert result["power_gained"] == 62_937
    assert result["total_power_after"] == 72_936
