from app.cards.comet_stellar_pup import compute


def _inputs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "starting_loyalty": 5,
        "loyalty_adjustment": 0,
        "rolls": [],
    }
    base.update(overrides)
    return base


def test_compute_reports_the_starting_state_before_any_roll() -> None:
    result = compute(_inputs())
    assert result["loyalty"] == 5
    assert result["activations_remaining"] == 1
    assert result["total_damage"] == 0
    assert result["comet_died"] is False


def test_compute_deals_damage_equal_to_loyalty_before_subtracting_two() -> None:
    # The card's central trap: damage resolves first, the -2 second. Doing it the other
    # way round would report 3 damage here instead of 5.
    result = compute(_inputs(rolls=["5"]))
    assert result["damage_this_activation"] == 5
    assert result["total_damage"] == 5
    assert result["loyalty"] == 3


def test_compute_lets_an_earlier_plus_two_roll_grow_a_later_damage_roll() -> None:
    # The whole reason rolls are an ordered sequence rather than per-outcome counters:
    # the same two rolls in this order deal 7, but a lone 4-5 deals only 5.
    result = compute(_inputs(rolls=["1", "5"]))
    assert result["damage_this_activation"] == 7
    assert result["loyalty"] == 5
    assert result["squirrels_created"] == 2


def test_compute_creates_two_squirrels_and_gains_two_loyalty_on_a_low_roll() -> None:
    result = compute(_inputs(rolls=["1"]))
    assert result["loyalty"] == 7
    assert result["squirrels_created"] == 2
    assert result["damage_this_activation"] == 0


def test_compute_returns_a_card_and_loses_one_loyalty_on_a_three() -> None:
    result = compute(_inputs(rolls=["3"]))
    assert result["loyalty"] == 4
    assert result["cards_returned"] == 1


def test_compute_grants_two_more_activations_on_a_six() -> None:
    # One activation a turn by default; the 6 spends one and hands back two.
    result = compute(_inputs(rolls=["6"]))
    assert result["loyalty"] == 6
    assert result["activations_remaining"] == 2


def test_compute_spends_the_activations_a_six_granted() -> None:
    result = compute(_inputs(rolls=["6", "1", "5"]))
    assert result["activations_remaining"] == 0
    assert result["damage_this_activation"] == 8
    assert result["loyalty"] == 6


def test_compute_chains_multiple_sixes_into_more_activations() -> None:
    # Two sixes grant four activations on top of the base one, minus the two spent.
    result = compute(_inputs(rolls=["6", "6"]))
    assert result["loyalty"] == 7
    assert result["activations_remaining"] == 3


def test_compute_resets_the_last_activations_damage_after_a_non_damage_roll() -> None:
    # damage_this_activation answers "what did that roll just deal", not "ever".
    result = compute(_inputs(rolls=["6", "5", "1"]))
    assert result["damage_this_activation"] == 0
    assert result["total_damage"] == 6


def test_compute_reports_negative_activations_when_more_rolls_are_logged_than_allowed() -> None:
    # The frontend's action guard blocks this, but a direct API call can still do it --
    # report it honestly rather than clamping and hiding the mistake.
    result = compute(_inputs(rolls=["1", "1"]))
    assert result["activations_remaining"] == -1


def test_compute_kills_comet_when_a_damage_roll_takes_loyalty_to_zero() -> None:
    result = compute(_inputs(starting_loyalty=2, rolls=["5"]))
    assert result["damage_this_activation"] == 2
    assert result["loyalty"] == 0
    assert result["comet_died"] is True
    assert result["activations_remaining"] == 0


def test_compute_kills_comet_when_a_three_roll_takes_loyalty_to_zero() -> None:
    result = compute(_inputs(starting_loyalty=1, rolls=["3"]))
    assert result["loyalty"] == 0
    assert result["comet_died"] is True


def test_compute_ignores_rolls_logged_after_comet_died() -> None:
    # He's in the graveyard -- a later roll never happened, so it must not revive him.
    result = compute(_inputs(starting_loyalty=2, rolls=["5", "1", "6"]))
    assert result["loyalty"] == 0
    assert result["squirrels_created"] == 0
    assert result["comet_died"] is True


def test_compute_clamps_loyalty_at_zero_rather_than_going_negative() -> None:
    # A -2 with only 1 loyalty left removes the one counter there is, it doesn't owe one.
    result = compute(_inputs(starting_loyalty=1, rolls=["5"]))
    assert result["damage_this_activation"] == 1
    assert result["loyalty"] == 0


def test_compute_at_upper_bound() -> None:
    # 40 sixes: +1 loyalty each, and two more activations each against the 40 spent.
    result = compute(_inputs(rolls=["6"] * 40))
    assert result["loyalty"] == 45
    assert result["activations_remaining"] == 1 + 40 * 2 - 40


def test_compute_treats_face_2_the_same_as_face_1() -> None:
    # 1 and 2 are one branch on the card, but the log now stores the face actually
    # rolled -- so both have to reach the same code path.
    assert compute(_inputs(rolls=["2"])) == compute(_inputs(rolls=["1"]))


def test_compute_treats_face_4_the_same_as_face_5() -> None:
    assert compute(_inputs(rolls=["4"])) == compute(_inputs(rolls=["5"]))


def test_compute_walks_every_face_in_one_reachable_turn() -> None:
    # Four 6s first, because each one nets a single extra activation (grants 2, spends
    # 1) -- 1 + 4x2 = 9 granted for exactly 9 rolls, so this sequence is one the
    # activation guard actually permits rather than an impossible log.
    #
    # Loyalty: 5 +1+1+1+1 = 9, +2 = 11, +2 = 13, -1 = 12, damage 12 then -2 = 10,
    # damage 10 then -2 = 8.
    result = compute(_inputs(rolls=["6", "6", "6", "6", "1", "2", "3", "4", "5"]))
    assert result["loyalty"] == 8
    assert result["total_damage"] == 22
    assert result["squirrels_created"] == 4
    assert result["cards_returned"] == 1
    assert result["activations_remaining"] == 0
    assert result["comet_died"] is False


def test_negative_adjustment_applies_before_the_rolls() -> None:
    # Hit for 1 between turns, then a damage roll: it deals the reduced loyalty.
    result = compute(_inputs(loyalty_adjustment=-1, rolls=["4"]))
    assert result["damage_this_activation"] == 4
    assert result["loyalty"] == 2


def test_positive_adjustment_raises_the_damage_roll() -> None:
    result = compute(_inputs(loyalty_adjustment=2, rolls=["4"]))
    assert result["damage_this_activation"] == 7


def test_enough_damage_between_activations_kills_him_outright() -> None:
    result = compute(_inputs(loyalty_adjustment=-5))
    assert result["comet_died"] is True
    assert result["loyalty"] == 0
    assert result["activations_remaining"] == 0


def test_dead_from_adjustment_ignores_any_logged_rolls() -> None:
    result = compute(_inputs(loyalty_adjustment=-9, rolls=["1", "1"]))
    assert result["squirrels_created"] == 0


def test_a_plain_zero_start_is_not_death() -> None:
    # The field floor, not damage: no adjustment means no death at zero.
    result = compute(_inputs(starting_loyalty=0))
    assert result["comet_died"] is False
