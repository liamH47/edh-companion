"""Venture into the dungeon: the four dungeon cards as one position-and-completion
tracker.

Like commander tax, this is a format mechanic rather than any single card -- venture is
granted by dozens of unrelated cards, and a player may walk several different dungeons
in one game -- so `scryfall_id` is None and the id is allowlisted in test_registry.py.

The wrinkle worth naming: the room fields are a state pointer with a paper answer (the
physical dungeon card ships with its own marker), and they exist mainly so the app can
derive completion correctly. The load-bearing output is `dungeons_completed` -- nothing
at the table accumulates that number across dungeon cards cycling through the command
zone, and it is the number completion payoffs (Sefris of the Hidden Ways, Gloom
Stalker) actually read. It is an explicit player-tapped counter, not derived from room
position: position resets the moment a new dungeon starts, and deriving the tally from
it would silently lose the count right then.

Undercity is included but gated by rule, not by the app: it is entered only by
"venture into Undercity" (taking the initiative -- its own card face says you can't
enter it otherwise), which the player knows they did; the app tracks position either
way and does not model the initiative itself. Room graphs were verified verbatim
against Scryfall (the four token-card oracle texts) on 2026-08-20.

Rules facts the tracker enforces or reflects (CR 309): one dungeon at a time; movement
is forward-only along a printed arrow, chosen at forks; the bottommost room's ability
resolving completes the dungeon and removes it, so "in a completed dungeon" is not a
state -- the player marks the tally and the next venture starts fresh.
"""

from typing import Any

from .schema import (
    ActionGuard,
    AlertSpec,
    ArtBox,
    CardMetadata,
    FieldKind,
    FieldSpec,
    MapEdge,
    MapNode,
    MapSpec,
    OutputSpec,
    SelectOption,
    VisibleIf,
)

MAX_DUNGEONS_COMPLETED = 99

# Room graphs, verbatim from the printed cards. Each entry: room id -> (label, column,
# row, successors, art box). Column is depth (0 = entry); row places siblings
# left-to-right. The art box is the room's region on the printed card image, as
# (x, y, w, h) fractions of its width/height -- measured against Scryfall's 488x680
# `normal` scans so the venture marker lands on the card's own room box. A room with
# no successors is the bottommost room -- completion, not a dead end.
_Box = tuple[float, float, float, float]
_Room = tuple[str, int, int, tuple[str, ...], _Box]

_DUNGEONS: dict[str, dict[str, _Room]] = {
    "phandelver": {
        "cave-entrance": (
            "Cave Entrance",
            0,
            0,
            ("goblin-lair", "mine-tunnels"),
            (0.08, 0.155, 0.84, 0.135),
        ),
        "goblin-lair": (
            "Goblin Lair",
            1,
            0,
            ("storeroom", "dark-pool"),
            (0.08, 0.305, 0.41, 0.165),
        ),
        "mine-tunnels": (
            "Mine Tunnels",
            1,
            1,
            ("dark-pool", "fungi-cavern"),
            (0.51, 0.305, 0.41, 0.165),
        ),
        "storeroom": ("Storeroom", 2, 0, ("temple-of-dumathoin",), (0.08, 0.487, 0.26, 0.225)),
        "dark-pool": ("Dark Pool", 2, 1, ("temple-of-dumathoin",), (0.352, 0.487, 0.296, 0.2)),
        "fungi-cavern": (
            "Fungi Cavern",
            2,
            2,
            ("temple-of-dumathoin",),
            (0.66, 0.487, 0.26, 0.225),
        ),
        "temple-of-dumathoin": ("Temple of Dumathoin", 3, 0, (), (0.08, 0.728, 0.84, 0.13)),
    },
    "tomb": {
        "trapped-entry": (
            "Trapped Entry",
            0,
            0,
            ("veils-of-fear", "oubliette"),
            (0.08, 0.155, 0.84, 0.12),
        ),
        "veils-of-fear": ("Veils of Fear", 1, 0, ("sandfall-cell",), (0.08, 0.295, 0.4, 0.2)),
        # The hard path: one brutal room where the cheap path takes two, joining the
        # same bottom -- the fork is asymmetric by design, not a diamond, and its
        # printed room spans both middle tiers of the card.
        "oubliette": ("Oubliette", 1, 1, ("cradle-of-the-death-god",), (0.5, 0.295, 0.42, 0.39)),
        "sandfall-cell": (
            "Sandfall Cell",
            2,
            0,
            ("cradle-of-the-death-god",),
            (0.08, 0.5, 0.4, 0.185),
        ),
        "cradle-of-the-death-god": ("Cradle of the Death God", 3, 0, (), (0.08, 0.7, 0.84, 0.145)),
    },
    "mad-mage": {
        "yawning-portal": ("Yawning Portal", 0, 0, ("dungeon-level",), (0.08, 0.145, 0.84, 0.08)),
        "dungeon-level": (
            "Dungeon Level",
            1,
            0,
            ("goblin-bazaar", "twisted-caverns"),
            (0.08, 0.235, 0.84, 0.062),
        ),
        "goblin-bazaar": ("Goblin Bazaar", 2, 0, ("lost-level",), (0.08, 0.303, 0.4, 0.14)),
        "twisted-caverns": ("Twisted Caverns", 2, 1, ("lost-level",), (0.49, 0.303, 0.43, 0.14)),
        "lost-level": (
            "Lost Level",
            3,
            0,
            ("runestone-caverns", "muirals-graveyard"),
            (0.08, 0.452, 0.84, 0.062),
        ),
        "runestone-caverns": (
            "Runestone Caverns",
            4,
            0,
            ("deep-mines",),
            (0.08, 0.525, 0.42, 0.14),
        ),
        "muirals-graveyard": (
            "Muiral's Graveyard",
            4,
            1,
            ("deep-mines",),
            (0.51, 0.525, 0.41, 0.14),
        ),
        "deep-mines": ("Deep Mines", 5, 0, ("mad-wizards-lair",), (0.08, 0.69, 0.84, 0.062)),
        "mad-wizards-lair": ("Mad Wizard's Lair", 6, 0, (), (0.08, 0.762, 0.84, 0.11)),
    },
    "undercity": {
        "secret-entrance": (
            "Secret Entrance",
            0,
            0,
            ("forge", "lost-well"),
            (0.08, 0.198, 0.84, 0.105),
        ),
        "forge": ("Forge", 1, 0, ("trap", "arena"), (0.08, 0.315, 0.41, 0.1)),
        "lost-well": ("Lost Well", 1, 1, ("arena", "stash"), (0.51, 0.315, 0.41, 0.1)),
        "trap": ("Trap!", 2, 0, ("archives",), (0.08, 0.43, 0.3, 0.12)),
        "arena": ("Arena", 2, 1, ("archives", "catacombs"), (0.393, 0.422, 0.19, 0.135)),
        "stash": ("Stash", 2, 2, ("catacombs",), (0.598, 0.435, 0.322, 0.11)),
        "archives": ("Archives", 3, 0, ("throne-of-the-dead-three",), (0.08, 0.598, 0.4, 0.098)),
        "catacombs": ("Catacombs", 3, 1, ("throne-of-the-dead-three",), (0.5, 0.572, 0.42, 0.14)),
        "throne-of-the-dead-three": (
            "Throne of the Dead Three",
            4,
            0,
            (),
            (0.08, 0.726, 0.84, 0.165),
        ),
    },
}

# The printed card each map depicts (Scryfall token-card ids; Undercity is the front
# face of the Undercity // The Initiative double-faced token).
_DUNGEON_CARDS = {
    "phandelver": "59b11ff8-f118-4978-87dd-509dc0c8c932",
    "tomb": "70b284bd-7a8f-4b60-8238-f746bdc5b236",
    "mad-mage": "6f509dbe-6ec7-4438-ab36-e20be46c9922",
    "undercity": "2c65185b-6cf0-451d-985e-56aa45d9a57d",
}

_DUNGEON_LABELS = {
    "phandelver": "Lost Mine of Phandelver",
    "tomb": "Tomb of Annihilation",
    "mad-mage": "Dungeon of the Mad Mage",
    "undercity": "Undercity",
}

_ENTRIES = {
    dungeon: next(room for room, (_, column, _row, _s, _box) in rooms.items() if column == 0)
    for dungeon, rooms in _DUNGEONS.items()
}


def _longest_path(dungeon: str) -> int:
    rooms = _DUNGEONS[dungeon]

    def depth(room: str) -> int:
        successors = rooms[room][3]
        return 1 + (max(depth(s) for s in successors) if successors else 0)

    return depth(_ENTRIES[dungeon])


def _path_field(dungeon: str) -> FieldSpec:
    rooms = _DUNGEONS[dungeon]
    return FieldSpec(
        name=f"{dungeon.replace('-', '_')}_path",
        label=f"Your path through {_DUNGEON_LABELS[dungeon]}",
        short_label="path",
        kind=FieldKind.SEQUENCE,
        default=[],
        max=_longest_path(dungeon),
        options=[SelectOption(value=room, label=label) for room, (label, *_rest) in rooms.items()],
        visible_if=VisibleIf(field="which_dungeon", equals=dungeon),
        map=MapSpec(
            entry=_ENTRIES[dungeon],
            scryfall_id=_DUNGEON_CARDS[dungeon],
            nodes=[
                MapNode(id=room, column=column, row=row, art=ArtBox(x=x, y=y, w=w, h=h))
                for room, (_label, column, row, _successors, (x, y, w, h)) in rooms.items()
            ],
            edges=[
                MapEdge(source=room, target=target)
                for room, (_label, _column, _row, successors, _box) in rooms.items()
                for target in successors
            ],
        ),
        help_text="Tap the next room each time you venture. Forward only -- the rules "
        "never let a marker move back up the card.",
    )


METADATA = CardMetadata(
    id="dungeons",
    name="Dungeons",
    # No scryfall_id: four different cards share this tracker, and picking one of their
    # images would misrepresent the other three. See test_registry.py's allowlist.
    rules_text=(
        "Venture into the dungeon: if you're not in a dungeon, choose one, put it into "
        "the command zone, and enter its first room. Otherwise, advance to the next "
        "room, choosing which arrow to follow at a fork -- never backwards. A room's "
        "ability triggers when you enter it. When the ability of the bottommost room "
        "has resolved, the dungeon is completed and removed; the next venture starts a "
        "fresh dungeon. You can be in only one dungeon at a time. Undercity is the "
        "exception on entry: you can't enter it unless an effect has you \"venture "
        'into Undercity" (the initiative).'
    ),
    resets_on_new_turn=False,
    fields=[
        FieldSpec(
            name="which_dungeon",
            label="Dungeon",
            short_label="dungeon",
            kind=FieldKind.SELECT,
            # Deliberately NOT setup: the dungeon changes every time one is completed,
            # so hiding the picker behind the board-state sheet would add a detour to
            # the most repeated action this screen has. It lives inline, above the map.
            default="none",
            options=[
                SelectOption(value="none", label="No dungeon"),
                SelectOption(value="phandelver", label="Lost Mine of Phandelver"),
                SelectOption(value="tomb", label="Tomb of Annihilation"),
                SelectOption(value="mad-mage", label="Dungeon of the Mad Mage"),
                SelectOption(value="undercity", label="Undercity (via the initiative)"),
            ],
            help_text="Undercity is entered only by taking the initiative -- its own "
            "card face says you can't enter it any other way.",
        ),
        *[_path_field(dungeon) for dungeon in _DUNGEONS],
        FieldSpec(
            name="dungeons_completed",
            label="Dungeons completed this game",
            short_label="completed",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_DUNGEONS_COMPLETED,
            action_label="Mark dungeon complete",
            action_disabled_when=ActionGuard(output="at_bottom_room", less_than=1),
            help_text="Tap when the bottom room's ability resolves, then pick your "
            "next dungeon. The tally is what completion payoffs read, and nothing at "
            "the table tracks it for you.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="dungeons_completed",
            label="Dungeons completed",
            short_label="completed",
            primary=True,
        ),
        OutputSpec(name="rooms_entered", label="Rooms entered", short_label="rooms"),
        OutputSpec(
            name="at_bottom_room",
            label="At the bottom room",
            short_label="at bottom",
            # Feeds the counter's ActionGuard only. The map's marker and the
            # completion banner already say it; a 0/1 tile repeating them was the
            # case that introduced `hidden`.
            hidden=True,
        ),
    ],
    alert=AlertSpec(
        output="dungeon_complete",
        message="Dungeon complete -- mark the tally, then venture anew",
        # Completion is the payoff, not a loss: accent banner, win sound.
        tone="success",
    ),
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    dungeon = str(inputs["which_dungeon"])
    in_dungeon = dungeon in _DUNGEONS
    path = list(inputs[f"{dungeon.replace('-', '_')}_path"]) if in_dungeon else []

    rooms_entered = len(path)
    # The bottommost room has no successors -- reaching it IS completion by rule
    # (CR 309.6-7): once its ability resolves the dungeon removes itself.
    at_bottom = bool(path) and not _DUNGEONS[dungeon][path[-1]][3]

    return {
        "dungeons_completed": int(inputs["dungeons_completed"]),
        "rooms_entered": rooms_entered,
        "at_bottom_room": 1 if at_bottom else 0,
        "dungeon_complete": at_bottom,
    }
