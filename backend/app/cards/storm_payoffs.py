"""Storm: the count is easy, the payoff table is not.

Storm copies a spell once for each spell cast before it this turn, so the spell resolves
`count + 1` times. That arithmetic is one line (`storm.py`), and four storm cards already
have their own screens for it. What they cannot answer is the question a storm turn
actually poses:

    "Storm is at nine. I'm holding Grapeshot and Tendrils. Which one wins, and does
    either one get there?"

So this is the roster of every storm card -- 34 of them, against four with screens -- and
what each does at the current count. Comparing two payoffs side by side at one count is
the whole point; nobody needs a calculator to multiply by ten, they need to see the two
numbers next to each other before deciding which to cast.

Two things this deliberately does NOT do:

  - **Aggregate across payoffs into a lethal alert.** You usually cast one of these, so
    a combined damage total would be a number describing a turn nobody took. The
    individual `tendrils_of_agony.py` screen keeps its lethal alert, where the input is
    unambiguous.
  - **Model per-cast permanents** (Guttersnipe, Young Pyromancer, Talrand). They scale
    with the same turn but a *different* count -- storm counts every player's spells,
    those count only your own qualifying ones -- and quietly sharing one number between
    them would be wrong in exactly the way this app exists to prevent. They are their own
    future roster, in the shape landfall already uses.

Copies of a storm spell are put onto the stack, never cast, so they never feed the storm
count of a later spell in the same turn. `storm.py` owns that subtlety.
"""

from typing import Any

from .effects import Source, build_lines
from .schema import (
    CardMetadata,
    FieldKind,
    FieldSpec,
    OutputKind,
    OutputSpec,
    PickerSpec,
    SelectOption,
)
from .storm import total_copies

MAX_STORM_COUNT = 99
MAX_PAYOFFS = 8

# Oracle text pulled verbatim from Scryfall 2026-08-21 (34 cards carry the keyword) and
# condensed to what fits a phone line. Ids match the existing single-card modules where
# one exists, so a card never has two ids in this codebase.
_SOURCES: dict[str, Source] = {
    "grapeshot": Source(
        label="Grapeshot",
        scryfall_id="e3e2d90a-3557-49d5-9986-cb50fd31f396",
        effect="1 damage to any target",
        totals=(("damage_one", 1),),
    ),
    "brain-freeze": Source(
        label="Brain Freeze",
        scryfall_id="3a2d7cf9-dddb-4de3-b4f2-c52e3ec8fb4b",
        effect="Target player mills three",
        totals=(("mill_one", 3),),
    ),
    "tendrils-of-agony": Source(
        label="Tendrils of Agony",
        scryfall_id="6f26faca-f338-4ce5-a218-6a61d40fc50a",
        effect="Target player loses 2 life, you gain 2",
        totals=(("life_loss", 2), ("life", 2)),
    ),
    "empty-the-warrens": Source(
        label="Empty the Warrens",
        scryfall_id="939d765a-aefb-4393-8808-98b1bbd7e803",
        effect="Create two 1/1 red Goblins",
        totals=(("tokens", 2),),
    ),
    "chatterstorm": Source(
        label="Chatterstorm",
        scryfall_id="b34f0ac1-6894-4761-b62c-b85d927acf09",
        effect="Create a 1/1 green Squirrel",
        totals=(("tokens", 1),),
    ),
    "hunting-pack": Source(
        label="Hunting Pack",
        scryfall_id="8c9eb595-e8fa-4a5e-abca-d30613c0e28f",
        effect="Create a 4/4 green Beast",
        totals=(("tokens", 1),),
    ),
    "crow-storm": Source(
        label="Crow Storm",
        scryfall_id="f5e0713c-8358-46fc-9618-66a986d681cb",
        effect="Create a 1/2 blue Bird named Storm Crow",
        totals=(("tokens", 1),),
    ),
    "elemental-eruption": Source(
        label="Elemental Eruption",
        scryfall_id="32126592-a988-4171-b52e-cca80b881aff",
        effect="Create a 4/4 red Dragon Elemental with flying and prowess",
        totals=(("tokens", 1),),
    ),
    "weather-the-storm": Source(
        label="Weather the Storm",
        scryfall_id="f6a9fa51-78c3-42e6-8c2e-39658f59ed87",
        effect="Gain 3 life",
        totals=(("life", 3),),
    ),
    "scattershot": Source(
        label="Scattershot",
        scryfall_id="cf22f3e7-1626-4bab-9f62-7d4774704395",
        effect="1 damage to target creature",
        totals=(("damage_one", 1),),
    ),
    "flusterstorm": Source(
        label="Flusterstorm",
        scryfall_id="f900eeb7-7c45-44bc-ad3a-0bbe594ecf50",
        effect="Counter target instant or sorcery unless its controller pays {1}",
    ),
    "hindering-touch": Source(
        label="Hindering Touch",
        scryfall_id="db9735d9-4aac-4175-8ec8-fc9bfd8f2c5c",
        effect="Counter target spell unless its controller pays {2}",
    ),
    "temporal-fissure": Source(
        label="Temporal Fissure",
        scryfall_id="c9f9ece7-ee6e-4379-9d53-209f8805a72d",
        effect="Return target permanent to its owner's hand",
    ),
    "wing-shards": Source(
        label="Wing Shards",
        scryfall_id="f8326bd2-83a8-4600-b12a-0bda47168f7b",
        effect="Target player sacrifices an attacking creature",
    ),
    "volcanic-awakening": Source(
        label="Volcanic Awakening",
        scryfall_id="aebd5c57-cfc8-4a3c-b4a2-0cd64a5e3575",
        effect="Destroy target land",
    ),
    "ground-rift": Source(
        label="Ground Rift",
        scryfall_id="62333783-6a18-4461-88ce-1c37eaf64e2b",
        effect="Target creature without flying can't block this turn",
    ),
    "dragonstorm": Source(
        label="Dragonstorm",
        scryfall_id="230cd568-f7ed-4571-a609-36522add91d0",
        effect="Search your library for a Dragon and put it onto the battlefield",
    ),
    "minds-desire": Source(
        label="Mind's Desire",
        scryfall_id="17ef3058-46b8-4ec4-950f-c721919c4ac1",
        effect="Exile the top card; you may play it free this turn",
    ),
    "galvanic-relay": Source(
        label="Galvanic Relay",
        scryfall_id="06373318-e548-4664-b227-17e3b6fd0a88",
        effect="Exile the top card; you may play it next turn",
    ),
    "sprouting-vines": Source(
        label="Sprouting Vines",
        scryfall_id="b16ba7be-47e6-4c64-918d-bec60abccaa3",
        effect="Search your library for a basic land, into your hand",
    ),
    "reaping-the-graves": Source(
        label="Reaping the Graves",
        scryfall_id="760a66bd-2821-4710-8f02-3c30772dd884",
        effect="Return target creature card from your graveyard to your hand",
    ),
    "ignite-memories": Source(
        label="Ignite Memories",
        scryfall_id="2f7b7831-27a1-4c0a-8ed1-6dddf2754d65",
        effect="Damage equal to the mana value of a card revealed at random from their hand",
    ),
    "storm-of-memories": Source(
        label="Storm of Memories",
        scryfall_id="253266de-0eeb-46c7-9912-145586661fc4",
        effect="Exile a cheap instant or sorcery from your graveyard at random and cast it free",
    ),
    "radstorm": Source(
        label="Radstorm",
        scryfall_id="d778cdec-8fc7-4174-bae1-4c8e8ccdfab3",
        effect="Proliferate",
    ),
    "haze-of-rage": Source(
        label="Haze of Rage",
        scryfall_id="c344b885-68c6-43d2-b6c1-6c89b3c94983",
        effect="Creatures you control get +1/+0 until end of turn",
    ),
    "astral-steel": Source(
        label="Astral Steel",
        scryfall_id="64f836d3-52c8-4628-b18a-8c8fb67969c9",
        effect="Target creature gets +1/+2 until end of turn",
    ),
    "spreading-insurrection": Source(
        label="Spreading Insurrection",
        scryfall_id="f1c1918b-2f7a-4cab-9547-029ebc589000",
        effect="Gain control of target creature you don't control, untapped and hasty",
    ),
    "mordor-on-the-march": Source(
        label="Mordor on the March",
        scryfall_id="6d553b1e-701b-4f09-80ce-2a16ab53e316",
        effect="Exile a creature from your graveyard and copy it, hasty until end of turn",
    ),
}

# Which totals earn their own tile. Damage and tokens are the two a storm turn is
# usually deciding between; everything else stays per-payoff in its own note, so a
# roster of counterspells is not asked to render "0 tokens".
_AGGREGATES: dict[str, str] = {
    "damage_dealt": "damage_one",
    "tokens_created": "tokens",
}

METADATA = CardMetadata(
    id="storm",
    name="Storm",
    # No scryfall_id: 34 cards share the keyword, and picking one image would
    # misrepresent the rest. See test_registry.py's allowlist.
    rules_text=(
        "Storm — When you cast this spell, copy it for each spell cast before it this "
        "turn. You may choose new targets for the copies. Spells cast by every player "
        "count, not just yours, and countered spells still count. The copies storm "
        "makes are put onto the stack rather than cast, so they never raise the count "
        "for a later spell in the same turn."
    ),
    fields=[
        FieldSpec(
            name="payoffs",
            label="Storm cards you're holding",
            short_label="payoffs",
            kind=FieldKind.SEQUENCE,
            default=[],
            max=MAX_PAYOFFS,
            setup=True,
            # A hand does not empty itself at end of turn, and re-picking your payoffs
            # every turn would make "New turn" the most expensive button on the screen.
            persists_across_turns=True,
            picker=PickerSpec(
                search_placeholder="Search storm cards",
                empty_label="No storm cards yet -- search and add what you're holding.",
            ),
            options=[
                SelectOption(value=source_id, label=source.label, scryfall_id=source.scryfall_id)
                for source_id, source in _SOURCES.items()
            ],
            help_text="Add every payoff you could cast, not just the one you plan to -- "
            "seeing two side by side at the same count is what this screen is for.",
        ),
        FieldSpec(
            name="storm_count",
            label="Spells cast before this one this turn",
            short_label="storm",
            kind=FieldKind.COUNTER,
            default=0,
            min=0,
            max=MAX_STORM_COUNT,
            action_label="Spell cast",
            help_text="Spells cast by every player this turn, not just you. Countered "
            "spells and spells cast from a graveyard or exile still count; the copies "
            "storm itself makes are not cast, so they never count.",
        ),
    ],
    outputs=[
        OutputSpec(
            name="effects",
            label="What each one does at this count",
            short_label="effects",
            kind=OutputKind.LINES,
            primary=True,
            hero_shape="list",
        ),
        OutputSpec(name="copies_from_storm", label="Copies from storm", short_label="copies"),
        OutputSpec(name="total_copies", label="Total resolutions", short_label="resolutions"),
        OutputSpec(name="damage_dealt", label="Damage, all payoffs", short_label="damage"),
        OutputSpec(name="tokens_created", label="Tokens, all payoffs", short_label="tokens"),
    ],
)


def compute(inputs: dict[str, Any]) -> dict[str, Any]:
    payoffs = [str(payoff_id) for payoff_id in inputs["payoffs"]]
    storm_count = int(inputs["storm_count"])

    # Every payoff resolves the same number of times: its copies plus the original. A
    # second copy of the same card in hand is a second spell you would have to cast, and
    # build_lines multiplies its line accordingly.
    resolutions = total_copies(storm_count)

    # No forecast note: a storm spell always resolves at least once, so there is no
    # "nothing has happened yet" state for a payoff to describe.
    effects, aggregate = build_lines(_SOURCES, payoffs, resolutions)

    return {
        "effects": effects,
        "copies_from_storm": storm_count,
        "total_copies": resolutions,
        **{output: aggregate.get(category, 0) for output, category in _AGGREGATES.items()},
    }
