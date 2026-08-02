from app.cards.nykthos_shrine_to_nyx import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "devotion_count": 0,
    }
    base.update(overrides)
    return base


def test_compute_produces_no_mana_with_zero_devotion() -> None:
    result = compute(_inputs())
    assert result["mana_produced"] == 0
    assert result["net_mana_after_activation_cost"] == -2


def test_compute_echoes_devotion_as_mana_produced() -> None:
    result = compute(_inputs(devotion_count=7))
    assert result["mana_produced"] == 7


def test_compute_subtracts_the_activation_cost_for_net_mana() -> None:
    result = compute(_inputs(devotion_count=7))
    assert result["net_mana_after_activation_cost"] == 5


def test_compute_allows_a_negative_net_when_devotion_is_low() -> None:
    # Below 2 devotion, activating loses mana overall -- that's a useful "don't" signal.
    result = compute(_inputs(devotion_count=1))
    assert result["net_mana_after_activation_cost"] == -1


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(devotion_count=99))
    assert result["mana_produced"] == 99
    assert result["net_mana_after_activation_cost"] == 97
