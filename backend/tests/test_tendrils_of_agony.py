from app.cards.tendrils_of_agony import METADATA, compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {"target_life": 40, "storm_count": 0}
    base.update(overrides)
    return base


def test_compute_drains_two_for_the_original_spell_alone() -> None:
    # Storm count 0 still resolves once -- the original spell.
    result = compute(_inputs())
    assert result["total_copies"] == 1
    assert result["life_drained"] == 2


def test_compute_drains_two_per_resolution() -> None:
    # 4 spells before it -> 4 copies + the original = 5 resolutions = 10 life.
    result = compute(_inputs(storm_count=4))
    assert result["copies_from_storm"] == 4
    assert result["total_copies"] == 5
    assert result["life_drained"] == 10


def test_compute_kills_from_twenty_at_storm_nine() -> None:
    # The reason the card is famous: 9 spells before it drains exactly 20.
    result = compute(_inputs(target_life=20, storm_count=9))
    assert result["life_drained"] == 20
    assert result["target_life_after"] == 0
    assert result["is_lethal"] is True


def test_compute_needs_storm_nineteen_from_a_full_commander_life_total() -> None:
    assert compute(_inputs(target_life=40, storm_count=18))["is_lethal"] is False
    assert compute(_inputs(target_life=40, storm_count=19))["is_lethal"] is True


def test_compute_gains_the_full_amount_however_the_losses_were_spread() -> None:
    # The gain half doesn't target, so it never splits even when the copies do.
    result = compute(_inputs(storm_count=3))
    assert result["life_gained"] == result["life_drained"]


def test_compute_clamps_their_life_at_zero_rather_than_going_negative() -> None:
    result = compute(_inputs(target_life=3, storm_count=9))
    assert result["life_drained"] == 20
    assert result["target_life_after"] == 0


def test_compute_treats_exactly_lethal_as_lethal() -> None:
    result = compute(_inputs(target_life=2, storm_count=0))
    assert result["is_lethal"] is True


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(target_life=999, storm_count=99))
    assert result["total_copies"] == 100
    assert result["life_drained"] == 200
    assert result["is_lethal"] is False


def test_metadata_declares_one_primary_output() -> None:
    assert [output.name for output in METADATA.outputs if output.primary] == ["life_drained"]


def test_metadata_alert_names_a_computed_output() -> None:
    assert METADATA.alert is not None
    assert METADATA.alert.output in compute(_inputs())
