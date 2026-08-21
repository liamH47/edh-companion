"""Landfall: the trigger nobody forgets, on a stack nobody can hold.

One land drop with Lotus Cobra, Tatyova and Tannuk on the battlefield is three separate
abilities, resolving in an order you choose, and the wrinkle is not any one of them --
it is that there are three. Add a fetchland crack or an Azusa and the same turn runs the
whole set four times over.

Two things go wrong in practice, and both are what this tracker is for:

  - **The rider that counts resolutions.** Tannuk, Nissa, Resurgent Animist and Scythecat
    Cub each do something *extra* the second time their ability resolves in a turn. That
    second resolution arrives on your second land drop of the turn, several minutes and
    several triggers after you read the card, and it is missed constantly.
  - **The running totals.** Nobody announces "each opponent has taken nine" correctly
    after three lands with three damage sources out.

Deliberately not modelled, because each would be a guess the app has no business making:

  - **Modal landfall** (Felidar Retreat, the Retreat cycle) -- "choose one" is a decision
    per resolution, and a tracker that picked for you would be wrong half the time.
  - **Board-state-conditional landfall** (Field of the Dead's seven differently-named
    lands, Avenger of Zendikar's Plant count, Springheart Nantuko's optional cost) --
    these need a board the app cannot see.
  - **Scute Swarm's copies past six lands**, which compound exponentially and have their
    own screen. The roster entry says the flat case and points at it.

Optional triggers ("you may") are listed with a "May" prefix and counted as though you
took them every time -- the common case, and the only one that produces a number at all.
"""

from dataclasses import dataclass
from typing import Any

from .schema import (
    CardMetadata,
    FieldKind,
    FieldSpec,
    OutputKind,
    OutputSpec,
    PickerSpec,
    SelectOption,
)

MAX_LANDS_PER_TURN = 99
MAX_TRIGGERS_PER_LAND = 4
MAX_SOURCES = 12
# "If this is the second time this ability has resolved this turn" -- the exact wording
# shared by Tannuk, Nissa, Resurgent Animist and Scythecat Cub.
SECOND_RESOLUTION = 2


@dataclass(frozen=True)
class _Source:
    """One landfall permanent: what it does per resolution, and what it totals to.

    `totals` is per resolution, in the categories `_TOTAL_TEMPLATES` knows how to phrase.
    A source with none is not an oversight -- proliferating or taking an extra combat is
    a real effect with no number attached, and the line still has to appear.
    """

    label: str
    scryfall_id: str
    effect: str
    totals: tuple[tuple[str, int], ...] = ()
    # Fires once per copy on the second resolution of the turn, never again.
    rider: str | None = None
    rider_totals: tuple[tuple[str, int], ...] = ()


# Oracle text pulled verbatim from Scryfall 2026-08-21 and condensed to the phrasing that
# fits a phone line; the ids are the print the picker shows.
_SOURCES: dict[str, _Source] = {
    "lotus-cobra": _Source(
        label="Lotus Cobra",
        scryfall_id="a4b759f0-901f-4be3-93fa-224609b08d48",
        effect="Add one mana of any color",
        totals=(("mana", 1),),
    ),
    "nissa-resurgent-animist": _Source(
        label="Nissa, Resurgent Animist",
        scryfall_id="248c76d3-b5cb-4582-be17-7cd1d0cb0f58",
        effect="Add one mana of any color (2nd resolution digs for an Elf or Elemental)",
        totals=(("mana", 1),),
        rider="2nd resolution dug for an Elf or Elemental",
    ),
    "tatyova-benthic-druid": _Source(
        label="Tatyova, Benthic Druid",
        scryfall_id="eabc978a-0666-472d-bdc6-d4b29d29eca4",
        effect="Gain 1 life and draw a card",
        totals=(("life", 1), ("cards", 1)),
    ),
    "aesi-tyrant-of-gyre-strait": _Source(
        label="Aesi, Tyrant of Gyre Strait",
        scryfall_id="673c21f8-02b6-4ac4-b2fc-df065b4ac662",
        effect="May draw a card",
        totals=(("cards", 1),),
    ),
    "courser-of-kruphix": _Source(
        label="Courser of Kruphix",
        scryfall_id="dc63d2ea-a980-466e-9ebb-f28008f84c3d",
        effect="Gain 1 life",
        totals=(("life", 1),),
    ),
    "druid-class": _Source(
        label="Druid Class",
        scryfall_id="09278e95-eaae-4cd4-a0d8-a2d15b0abb58",
        effect="Gain 1 life",
        totals=(("life", 1),),
    ),
    "primeval-bounty": _Source(
        label="Primeval Bounty",
        scryfall_id="332c9742-dc3b-48e5-8736-7724fae1b4c4",
        effect="Gain 3 life",
        totals=(("life", 3),),
    ),
    "tannuk-memorial-ensign": _Source(
        label="Tannuk, Memorial Ensign",
        scryfall_id="52498b7b-0389-4e7b-b29f-7ac86aab9229",
        effect="1 damage to each opponent (2nd resolution also draws)",
        totals=(("damage_each", 1),),
        rider="2nd resolution drew a card",
        rider_totals=(("cards", 1),),
    ),
    "tunneling-geopede": _Source(
        label="Tunneling Geopede",
        scryfall_id="d4071152-5e64-4133-88a2-8fa5cb0eeb6c",
        effect="1 damage to each opponent",
        totals=(("damage_each", 1),),
    ),
    "sabotender": _Source(
        label="Sabotender",
        scryfall_id="12df1295-8b08-4c8e-bac9-55b4f514c0be",
        effect="1 damage to each opponent",
        totals=(("damage_each", 1),),
    ),
    "iridescent-vinelasher": _Source(
        label="Iridescent Vinelasher",
        scryfall_id="b2bc854c-4e72-48e0-a098-e3451d6e511d",
        effect="1 damage to target opponent",
        totals=(("damage_one", 1),),
    ),
    "ob-nixilis-the-fallen": _Source(
        label="Ob Nixilis, the Fallen",
        scryfall_id="dc9d3ada-9d0d-489a-89b7-08f53f6601e1",
        effect="May drain a player for 3, then grow by three +1/+1 counters",
        totals=(("life_loss", 3), ("counters", 3)),
    ),
    "rampaging-baloths": _Source(
        label="Rampaging Baloths",
        scryfall_id="84aa18de-6acc-46cc-8e28-3046790a6751",
        effect="Create a 4/4 green Beast",
        totals=(("tokens", 1),),
    ),
    "zendikars-roil": _Source(
        label="Zendikar's Roil",
        scryfall_id="60297593-2438-48d7-9414-48af114a93d2",
        effect="Create a 2/2 green Elemental",
        totals=(("tokens", 1),),
    ),
    "omnath-locus-of-rage": _Source(
        label="Omnath, Locus of Rage",
        scryfall_id="637c5910-f835-496e-b1b9-445bfb71da97",
        effect="Create a 5/5 red and green Elemental",
        totals=(("tokens", 1),),
    ),
    "greensleeves-maro-sorcerer": _Source(
        label="Greensleeves, Maro-Sorcerer",
        scryfall_id="0969d7f3-cec5-4118-adb1-ff957eedf6ab",
        effect="Create a 3/3 green Badger",
        totals=(("tokens", 1),),
    ),
    "emeria-angel": _Source(
        label="Emeria Angel",
        scryfall_id="2406ab7c-c6be-421a-a92c-048441a01acd",
        effect="May create a 1/1 white Bird with flying",
        totals=(("tokens", 1),),
    ),
    "tireless-provisioner": _Source(
        label="Tireless Provisioner",
        scryfall_id="a1e048e0-19d2-4076-892d-f8b3104dee37",
        effect="Create a Food or a Treasure token",
        totals=(("tokens", 1),),
    ),
    "tireless-tracker": _Source(
        label="Tireless Tracker",
        scryfall_id="66444549-ad9b-49c6-a7c6-34e977c1085d",
        effect="Investigate (a Clue token)",
        totals=(("tokens", 1),),
    ),
    "scute-swarm": _Source(
        label="Scute Swarm",
        scryfall_id="ea630ba1-22f9-4a10-bdc6-0d03128214f4",
        effect="Create a 1/1 Insect -- a copy of itself instead once you control six lands",
        totals=(("tokens", 1),),
    ),
    "bristly-bill-spine-sower": _Source(
        label="Bristly Bill, Spine Sower",
        scryfall_id="52eef0d6-24b7-40b7-8403-e8e863d0cd55",
        effect="Put a +1/+1 counter on target creature",
        totals=(("counters", 1),),
    ),
    "scythecat-cub": _Source(
        label="Scythecat Cub",
        scryfall_id="b3dd3c7d-4685-4579-b483-14ddaaaddf5b",
        effect="Put a +1/+1 counter on target creature (2nd resolution doubles instead)",
        totals=(("counters", 1),),
        rider="2nd resolution doubled that creature's counters instead",
    ),
    "hedron-crab": _Source(
        label="Hedron Crab",
        scryfall_id="d109b70e-862f-4d8a-8b40-ef6dc904868f",
        effect="Target player mills three",
        totals=(("mill_one", 3),),
    ),
    "ruin-crab": _Source(
        label="Ruin Crab",
        scryfall_id="738ce273-c938-42d2-83b2-c4f5f4000b0b",
        effect="Each opponent mills three",
        totals=(("mill_each", 3),),
    ),
    "icetill-explorer": _Source(
        label="Icetill Explorer",
        scryfall_id="d9482aab-6ddf-48e1-84fa-b13d5ff81e69",
        effect="Mill a card",
        totals=(("mill_self", 1),),
    ),
    "evolution-sage": _Source(
        label="Evolution Sage",
        scryfall_id="1d58d08d-cd62-416d-8d8e-7d9c56d5c4da",
        effect="Proliferate",
    ),
    "moraug-fury-of-akoum": _Source(
        label="Moraug, Fury of Akoum",
        scryfall_id="4481eab8-9e7d-4db8-b1f2-fdf5ee1919a2",
        effect="An extra combat phase, if it's your main phase",
    ),
    "bloodghast": _Source(
        label="Bloodghast",
        scryfall_id="cee85485-598f-4dfc-aa0b-7b1de86c7788",
        effect="May return it from your graveyard to the battlefield",
    ),
    "valakut-exploration": _Source(
        label="Valakut Exploration",
        scryfall_id="18cb7bf6-9c7c-4e62-a678-7b75862e2f64",
        effect="Exile the top card; you may play it while it remains exiled",
    ),
}

# How each total is phrased, and the order the phrases appear in a note. Keeping the
# order here rather than at the call site means two sources with the same categories
# always read the same way round.
_TOTAL_TEMPLATES: dict[str, str] = {
    "mana": "{n} mana",
    "cards": "{n} card{s}",
    "life": "{n} life",
    "damage_each": "{n} damage to each opponent",
    "damage_one": "{n} damage",
    "life_loss": "{n} life lost",
    "tokens": "{n} token{s}",
    "counters": "{n} counter{s}",
    "mill_self": "{n} milled",
    "mill_one": "{n} milled by a player",
    "mill_each": "{n} milled by each opponent",
}

# Which totals roll up into which output. Everything else stays per-source in its note --
# a tile reading "0 milled" on a board with no crabs is noise, and every roster would
# otherwise need a tile for every category any card could ever contribute.
_AGGREGATES: dict[str, str] = {
    "cards_drawn": "cards",
    "life_gained": "life",
    "damage_each_opponent": "damage_each",
    "tokens_created": "tokens",
}

METADATA = CardMetadata(
    id="landfall",
    name="Landfall",
    # No scryfall_id: this tracks a mechanic dozens of cards share, and picking one of
    # their images would misrepresent the rest. See test_registry.py's allowlist.
    rules_text=(
        "Landfall — Whenever a land you control enters, each landfall permanent you "
        "control triggers separately. They go on the stack together and you choose the "
        "order they resolve in. A few cards do something extra the second time their "
        "ability resolves in a turn, which is your second land drop, not your second "
        "permanent. Optional triggers are counted here as though you take them every "
        "time; modal landfall and effects that depend on board state the app cannot see "
        "are listed nowhere in this roster."
    ),
    fields=[
        FieldSpec(
            name="sources",
            label="Landfall permanents you control",
            short_label="permanents",
            kind=FieldKind.SEQUENCE,
            default=[],
            max=MAX_SOURCES,
            setup=True,
            # The board does not empty itself at end of turn; a "New turn" that wiped
            # this would make the button unusable on its own screen.
            persists_across_turns=True,
            picker=PickerSpec(
                search_placeholder="Search landfall cards",
                empty_label="No landfall permanents yet -- search and add what you control.",
            ),
            options=[
                SelectOption(value=source_id, label=source.label, scryfall_id=source.scryfall_id)
                for source_id, source in _SOURCES.items()
            ],
            help_text="Add a card twice if you control two of it -- each copy triggers "
            "on its own. Modal cards (Felidar Retreat, the Retreat cycle) are left out "
            "on purpose: the choice is yours every resolution, so no total would be right.",
        ),
        FieldSpec(
            name="triggers_per_land",
            label="Landfall triggers per land",
            short_label="per land",
            kind=FieldKind.NUMBER,
            default=1,
            min=1,
            max=MAX_TRIGGERS_PER_LAND,
            setup=True,
            persists_across_turns=True,
            help_text="1 normally. 2 with Ancient Greenwarden or another landfall doubler.",
        ),
        FieldSpec(
            name="lands_this_turn",
            label="Lands entered this turn",
            short_label="lands",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_LANDS_PER_TURN,
            action_label="Land enters",
            help_text="Any land entering under your control, not just your land drop -- "
            "a fetchland counts twice, once for itself and once for what it finds.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="effects",
            label="What each land drop does",
            short_label="effects",
            kind=OutputKind.LINES,
            primary=True,
            hero_shape="list",
        ),
        OutputSpec(name="triggers", label="Triggers this turn", short_label="triggers"),
        OutputSpec(name="cards_drawn", label="Cards drawn", short_label="cards"),
        OutputSpec(name="life_gained", label="Life gained", short_label="life"),
        OutputSpec(
            name="damage_each_opponent",
            label="Damage to each opponent",
            short_label="each opp",
        ),
        OutputSpec(name="tokens_created", label="Tokens created", short_label="tokens"),
    ],
)


def _phrase(category: str, amount: int) -> str:
    return _TOTAL_TEMPLATES[category].format(n=amount, s="" if amount == 1 else "s")


def _note(totals: dict[str, int], resolutions: int, rider_fired: str | None) -> str:
    """The right-hand side of an effect line: what this source has actually produced so
    far this turn. Before the first land drop it reads as a forecast instead, which is
    what the player is looking at the screen for while deciding whether to crack a fetch.
    """
    if resolutions == 0:
        return "on your next land"
    parts = [
        _phrase(category, totals[category])
        for category in _TOTAL_TEMPLATES
        if totals.get(category, 0) != 0
    ]
    # A source with no countable output still needs to say it happened.
    if not parts:
        parts = [f"x{resolutions}"]
    if rider_fired is not None:
        parts.append(rider_fired)
    return " · ".join(parts)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    sources = [str(source_id) for source_id in inputs["sources"]]
    triggers_per_land = int(inputs["triggers_per_land"])
    lands_this_turn = int(inputs["lands_this_turn"])

    # How many times each *individual* ability resolves this turn. A second copy of a
    # card is a second ability, not a bigger one -- which is why the rider below fires
    # per copy rather than once for the whole roster.
    per_ability = lands_this_turn * triggers_per_land

    copies: dict[str, int] = {}
    for source_id in sources:
        copies[source_id] = copies.get(source_id, 0) + 1

    effects: list[dict[str, str]] = []
    aggregate: dict[str, int] = {}

    for source_id, count in copies.items():
        source = _SOURCES[source_id]
        resolutions = per_ability * count

        totals: dict[str, int] = {
            category: amount * resolutions for category, amount in source.totals
        }
        # "The second time this ability has resolved this turn" -- once per copy, on the
        # turn's second land drop, and never again however many more lands follow.
        rider_fired = source.rider if per_ability >= SECOND_RESOLUTION else None
        if rider_fired is not None:
            for category, amount in source.rider_totals:
                totals[category] = totals.get(category, 0) + amount * count

        for category, amount in totals.items():
            aggregate[category] = aggregate.get(category, 0) + amount

        effects.append(
            {
                "source": source.label if count == 1 else f"{source.label} x{count}",
                "effect": source.effect,
                "note": _note(totals, resolutions, rider_fired),
            }
        )

    return {
        "effects": effects,
        "triggers": per_ability * len(sources),
        **{output: aggregate.get(category, 0) for output, category in _AGGREGATES.items()},
    }
