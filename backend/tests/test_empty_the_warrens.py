from app.cards.empty_the_warrens import METADATA, compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {"storm_count": 0}
    base.update(overrides)
    return base


def test_compute_makes_two_goblins_for_the_original_spell_alone() -> None:
    result = compute(_inputs())
    assert result["total_copies"] == 1
    assert result["goblins_created"] == 2


def test_compute_makes_two_goblins_per_resolution() -> None:
    # 5 spells before it -> 5 copies + the original = 6 resolutions = 12 Goblins.
    result = compute(_inputs(storm_count=5))
    assert result["copies_from_storm"] == 5
    assert result["total_copies"] == 6
    assert result["goblins_created"] == 12


def test_compute_reports_next_turns_damage_since_the_goblins_lack_haste() -> None:
    # They are 1/1s that cannot attack the turn they arrive, so this is next turn.
    result = compute(_inputs(storm_count=3))
    assert result["goblins_created"] == 8
    assert result["damage_next_turn"] == 8


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(storm_count=99))
    assert result["total_copies"] == 100
    assert result["goblins_created"] == 200
    assert result["damage_next_turn"] == 200


def test_metadata_declares_one_primary_output() -> None:
    assert [output.name for output in METADATA.outputs if output.primary] == ["goblins_created"]


def test_metadata_declares_no_alert() -> None:
    # Nothing about a board of Goblins is a state-based event worth a banner.
    assert METADATA.alert is None
