from app.cards.aetherflux_reservoir import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "was_in_play_at_turn_start": True,
        "spells_already_cast": 0,
        "spells_cast_this_turn": 0,
        "starting_life": 0,
        "activations_used": 0,
    }
    base.update(overrides)
    return base


def test_compute_gains_one_life_on_first_spell_when_reservoir_started_in_play() -> None:
    # "This turn" counts the triggering spell itself, so the very first spell gains 1.
    result = compute(_inputs(spells_cast_this_turn=1))
    assert result["life_this_spell"] == 1
    assert result["total_life"] == 1


def test_compute_accumulates_life_across_multiple_spells() -> None:
    result = compute(_inputs(spells_cast_this_turn=4))
    assert result["life_this_spell"] == 4
    assert result["total_life"] == 10


def test_compute_spells_cast_this_turn_reflects_the_true_running_total() -> None:
    # Regression case: the field used to only track spells cast *since* the Reservoir
    # entered play, so a player who'd cast 2 spells before it entered and then 1 more
    # saw the counter read "1" even though 3 spells had truly been cast this turn (and
    # the 3rd spell correctly gained 3 life) -- confusing. The field now holds the true
    # running total (3), and the Reservoir-only portion is derived internally.
    result = compute(
        _inputs(was_in_play_at_turn_start=False, spells_already_cast=2, spells_cast_this_turn=3)
    )
    assert result["life_this_spell"] == 3
    assert result["total_life"] == 3


def test_compute_returns_zero_when_no_spells_cast_yet() -> None:
    result = compute(_inputs())
    assert result["life_this_spell"] == 0
    assert result["total_life"] == 0


def test_compute_counts_baseline_when_reservoir_entered_mid_turn() -> None:
    result = compute(
        _inputs(was_in_play_at_turn_start=False, spells_already_cast=3, spells_cast_this_turn=5)
    )
    assert result["life_this_spell"] == 5
    assert result["total_life"] == 9


def test_compute_clamps_to_zero_when_total_is_below_the_baseline() -> None:
    # Not a normal flow, but a directly-typeable value (the counter accepts direct
    # entry): if someone types a total lower than the baseline they set, treat it as
    # "no spells cast since the Reservoir entered" rather than going negative.
    result = compute(
        _inputs(was_in_play_at_turn_start=False, spells_already_cast=5, spells_cast_this_turn=2)
    )
    assert result["life_this_spell"] == 0
    assert result["total_life"] == 0


def test_compute_at_upper_bound() -> None:
    result = compute(_inputs(spells_cast_this_turn=99))
    assert result["life_this_spell"] == 99
    assert result["total_life"] == 4950


def test_compute_current_life_combines_starting_life_and_spell_life_gain() -> None:
    result = compute(_inputs(spells_cast_this_turn=4, starting_life=40))
    assert result["current_life"] == 50


def test_compute_reports_no_activations_when_current_life_is_below_fifty() -> None:
    result = compute(_inputs(starting_life=10))
    assert result["possible_activations"] == 0
    assert result["damage_available"] == 0


def test_compute_reports_activations_and_damage_when_life_affords_them() -> None:
    result = compute(_inputs(starting_life=120))
    assert result["possible_activations"] == 2
    assert result["damage_available"] == 100


def test_compute_spells_until_next_activation_from_zero_life() -> None:
    result = compute(_inputs())
    assert result["spells_until_next_activation"] == 10


def test_compute_spells_until_next_activation_needs_a_full_fifty_on_a_threshold() -> None:
    # 100 life already affords 2 activations; reaching a 3rd still needs a full 50 more,
    # same as starting from 0 -- the count-up is identical, only possible_activations differs.
    result = compute(_inputs(starting_life=100))
    assert result["possible_activations"] == 2
    assert result["spells_until_next_activation"] == 10


def test_compute_spells_until_next_activation_is_short_when_life_is_close() -> None:
    result = compute(_inputs(starting_life=45))
    assert result["spells_until_next_activation"] == 3


def test_compute_spells_until_next_activation_continues_from_spells_already_cast() -> None:
    # 5 spells already cast this turn (with the Reservoir out) means the *next* spell
    # gains 6 life, not 1 -- the projection must continue from there, not restart at zero.
    result = compute(_inputs(spells_cast_this_turn=5))
    assert result["spells_until_next_activation"] == 5


def test_compute_deducts_life_and_tracks_damage_per_activation() -> None:
    result = compute(_inputs(starting_life=120, activations_used=1))
    assert result["current_life"] == 70
    assert result["damage_dealt"] == 50
    assert result["possible_activations"] == 1


def test_compute_accumulates_damage_across_multiple_activations() -> None:
    result = compute(_inputs(starting_life=120, activations_used=2))
    assert result["current_life"] == 20
    assert result["damage_dealt"] == 100
    assert result["possible_activations"] == 0


def test_compute_allows_current_life_to_go_negative_when_overpaid() -> None:
    # Not a legal in-game action (you can't pay life you don't have), but the calculator
    # reflects it honestly rather than erroring -- it's an obvious, self-correctable
    # signal rather than a state the tool needs to police.
    result = compute(_inputs(starting_life=40, activations_used=2))
    assert result["current_life"] == -60
    assert result["damage_dealt"] == 100


def test_compute_clamps_activations_and_spell_projection_when_life_is_negative() -> None:
    result = compute(_inputs(starting_life=40, activations_used=2))
    assert result["possible_activations"] == 0
    assert result["damage_available"] == 0
    # Projected from an effective (clamped) life of 0, same as the from-zero case.
    assert result["spells_until_next_activation"] == 10


def test_compute_flags_game_lost_when_paying_the_activation_cost_hits_exactly_zero_life() -> None:
    result = compute(_inputs(starting_life=50, activations_used=1))
    assert result["current_life"] == 0
    assert result["game_lost"] is True


def test_compute_flags_game_lost_when_current_life_goes_negative() -> None:
    result = compute(_inputs(starting_life=40, activations_used=1))
    assert result["current_life"] == -10
    assert result["game_lost"] is True


def test_compute_does_not_flag_game_lost_while_life_remains_positive() -> None:
    result = compute(_inputs(starting_life=50))
    assert result["current_life"] == 50
    assert result["game_lost"] is False
