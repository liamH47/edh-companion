from app.cards.scute_swarm import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "current_land_count": 0,
        "scute_swarm_count": 1,
        "insect_token_count": 0,
        "lands_played": 0,
    }
    base.update(overrides)
    return base


def test_compute_returns_the_starting_state_when_no_lands_are_played() -> None:
    result = compute(_inputs(current_land_count=3, scute_swarm_count=2, insect_token_count=5))
    assert result["final_land_count"] == 3
    assert result["final_scute_swarm_count"] == 2
    assert result["final_insect_count"] == 5
    assert result["total_power"] == 7


def test_compute_adds_one_insect_per_land_below_the_six_land_threshold() -> None:
    # 0 -> 1 -> 2 -> 3 lands, always under six, so each trigger makes a plain Insect.
    result = compute(_inputs(current_land_count=0, scute_swarm_count=1, lands_played=3))
    assert result["final_land_count"] == 3
    assert result["final_scute_swarm_count"] == 1
    assert result["final_insect_count"] == 3
    assert result["total_power"] == 4


def test_compute_doubles_the_swarm_count_the_instant_six_lands_is_reached() -> None:
    # 5 -> 6 lands: the land that crosses the threshold makes a copy, not an Insect.
    result = compute(_inputs(current_land_count=5, scute_swarm_count=1, lands_played=1))
    assert result["final_land_count"] == 6
    assert result["final_scute_swarm_count"] == 2
    assert result["final_insect_count"] == 0


def test_compute_keeps_doubling_once_past_the_threshold() -> None:
    # Already at six lands: every further land drop doubles the (growing) swarm count.
    result = compute(_inputs(current_land_count=6, scute_swarm_count=1, lands_played=3))
    assert result["final_land_count"] == 9
    assert result["final_scute_swarm_count"] == 8  # 1 -> 2 -> 4 -> 8
    assert result["final_insect_count"] == 0


def test_compute_switches_from_insects_to_doubling_mid_sequence() -> None:
    # 4 -> 5 (Insect) -> 6 (copy) -> 7 (copy): threshold crossed partway through.
    result = compute(_inputs(current_land_count=4, scute_swarm_count=1, lands_played=3))
    assert result["final_land_count"] == 7
    assert result["final_insect_count"] == 1  # from the 4 -> 5 land drop
    assert result["final_scute_swarm_count"] == 4  # 1 -> 2 (at 6) -> 4 (at 7)
    assert result["total_power"] == 5


def test_compute_accounts_for_existing_insects_and_swarm_copies() -> None:
    result = compute(
        _inputs(current_land_count=6, scute_swarm_count=3, insect_token_count=10, lands_played=1)
    )
    assert result["final_scute_swarm_count"] == 6  # already past the threshold, so it doubles
    assert result["final_insect_count"] == 10  # untouched this trigger
    assert result["total_power"] == 16


def test_compute_at_upper_bound() -> None:
    result = compute(
        _inputs(
            current_land_count=99,
            scute_swarm_count=999_999_999,
            insect_token_count=999_999_999,
            lands_played=99,
        )
    )
    # Already at 99 lands (>= 6), so every one of the 99 more lands doubles the swarm.
    assert result["final_land_count"] == 198
    assert result["final_scute_swarm_count"] == 999_999_999 * 2**99
    assert result["final_insect_count"] == 999_999_999
    assert result["total_power"] == 999_999_999 * 2**99 + 999_999_999
