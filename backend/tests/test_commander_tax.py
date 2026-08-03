from app.cards.commander_tax import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "base_commander_cost": 4,
        "flat_cost_reduction": 0,
        "times_cast_from_command_zone": 0,
    }
    base.update(overrides)
    return base


def test_first_cast_costs_the_base_with_no_tax() -> None:
    result = compute(_inputs())
    assert result["commander_tax"] == 0
    assert result["current_cast_cost"] == 4


def test_each_prior_cast_adds_two() -> None:
    # Cast twice already, so the third cast is base 4 + 2*2 = 8.
    result = compute(_inputs(times_cast_from_command_zone=2))
    assert result["commander_tax"] == 4
    assert result["current_cast_cost"] == 8


def test_reduction_lowers_the_total() -> None:
    # base 4 + tax 4 (two prior casts) - reduction 3 = 5.
    result = compute(_inputs(times_cast_from_command_zone=2, flat_cost_reduction=3))
    assert result["current_cast_cost"] == 5


def test_reduction_never_drives_the_cost_below_zero() -> None:
    # A big reducer on a cheap, never-recast commander: 2 + 0 - 5 floors at 0, not -3.
    result = compute(_inputs(base_commander_cost=2, flat_cost_reduction=5))
    assert result["current_cast_cost"] == 0


def test_compute_at_upper_bound() -> None:
    # Every field maxed: 20 + 2*30 - 0 = 80.
    result = compute(
        _inputs(
            base_commander_cost=20,
            times_cast_from_command_zone=30,
            flat_cost_reduction=0,
        )
    )
    assert result["commander_tax"] == 60
    assert result["current_cast_cost"] == 80
