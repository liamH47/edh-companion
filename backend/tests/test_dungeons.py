"""Dungeons: position + completion only. The walk itself is validated generically in
validation.py (illegal_room); these tests cover compute() and the module's shape."""

import pytest

from app.cards.dungeons import METADATA, compute
from app.cards.validation import InputError, validate_inputs

BASE = {
    "which_dungeon": "none",
    "phandelver_path": [],
    "tomb_path": [],
    "mad_mage_path": [],
    "undercity_path": [],
    "dungeons_completed": 0,
}


def run(**overrides: object) -> dict[str, object]:
    return compute({**BASE, **overrides})


def test_no_dungeon_is_the_quiet_default() -> None:
    outputs = run()
    assert outputs == {
        "dungeons_completed": 0,
        "rooms_entered": 0,
        "at_bottom_room": 0,
        "dungeon_complete": False,
    }


def test_mid_dungeon_is_not_complete() -> None:
    outputs = run(which_dungeon="phandelver", phandelver_path=["cave-entrance", "goblin-lair"])
    assert outputs["rooms_entered"] == 2
    assert outputs["at_bottom_room"] == 0
    assert outputs["dungeon_complete"] is False


def test_reaching_the_bottom_room_completes() -> None:
    outputs = run(
        which_dungeon="phandelver",
        phandelver_path=["cave-entrance", "mine-tunnels", "dark-pool", "temple-of-dumathoin"],
    )
    assert outputs["at_bottom_room"] == 1
    assert outputs["dungeon_complete"] is True


def test_tomb_hard_path_completes_in_three_rooms() -> None:
    # Oubliette is one brutal room where the cheap path takes two; both join the same
    # bottom. The asymmetry is the printed card's, not an app approximation.
    outputs = run(
        which_dungeon="tomb",
        tomb_path=["trapped-entry", "oubliette", "cradle-of-the-death-god"],
    )
    assert outputs["rooms_entered"] == 3
    assert outputs["dungeon_complete"] is True


def test_only_the_selected_dungeon_counts() -> None:
    # A stale path on a hidden field must not leak into the outputs.
    outputs = run(
        which_dungeon="tomb",
        phandelver_path=["cave-entrance"],
        tomb_path=[],
    )
    assert outputs["rooms_entered"] == 0


def test_completed_tally_passes_through_untouched() -> None:
    outputs = run(dungeons_completed=7)
    assert outputs["dungeons_completed"] == 7


def test_compute_at_upper_bound() -> None:
    # The longest legal walk through the longest dungeon, at the tally cap.
    full_mad_mage = [
        "yawning-portal",
        "dungeon-level",
        "goblin-bazaar",
        "lost-level",
        "runestone-caverns",
        "deep-mines",
        "mad-wizards-lair",
    ]
    outputs = run(
        which_dungeon="mad-mage",
        mad_mage_path=full_mad_mage,
        dungeons_completed=99,
    )
    assert outputs["rooms_entered"] == 7
    assert outputs["dungeons_completed"] == 99
    assert outputs["dungeon_complete"] is True


def test_validate_accepts_an_empty_walk() -> None:
    # Not-yet-ventured is the resting state of every hidden path field.
    validated = validate_inputs(METADATA.fields, BASE)
    assert validated["phandelver_path"] == []


def test_validate_rejects_a_path_not_starting_at_the_entry() -> None:
    with pytest.raises(InputError) as error:
        validate_inputs(METADATA.fields, {**BASE, "phandelver_path": ["goblin-lair"]})
    assert error.value.code == "illegal_room"
    assert error.value.field == "phandelver_path"


def test_validate_rejects_a_teleport_between_rooms() -> None:
    # Fungi Cavern is only reachable via Mine Tunnels -- the road not taken stays
    # not taken (CR 309: forward along an arrow only).
    with pytest.raises(InputError) as error:
        validate_inputs(
            METADATA.fields,
            {**BASE, "phandelver_path": ["cave-entrance", "goblin-lair", "fungi-cavern"]},
        )
    assert error.value.code == "illegal_room"


def test_validate_accepts_every_full_clear() -> None:
    clears = {
        "phandelver_path": ["cave-entrance", "goblin-lair", "storeroom", "temple-of-dumathoin"],
        "tomb_path": ["trapped-entry", "veils-of-fear", "sandfall-cell", "cradle-of-the-death-god"],
        "mad_mage_path": [
            "yawning-portal",
            "dungeon-level",
            "twisted-caverns",
            "lost-level",
            "muirals-graveyard",
            "deep-mines",
            "mad-wizards-lair",
        ],
        "undercity_path": [
            "secret-entrance",
            "lost-well",
            "stash",
            "catacombs",
            "throne-of-the-dead-three",
        ],
    }
    validated = validate_inputs(METADATA.fields, {**BASE, **clears})
    for field, path in clears.items():
        assert validated[field] == path


def test_dungeons_is_a_game_long_tracker() -> None:
    # No turn boundary to reset at: the completed tally must survive "New turn", so
    # the button is withheld entirely.
    assert METADATA.resets_on_new_turn is False
    assert METADATA.scryfall_id is None
