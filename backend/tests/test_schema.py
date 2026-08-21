import pytest

from app.cards.schema import (
    AlertSpec,
    ArtBox,
    CardMetadata,
    FieldKind,
    FieldSpec,
    MapEdge,
    MapNode,
    MapSpec,
    OutputSpec,
    RollSpec,
    SelectOption,
)


def test_field_spec_rejects_select_kind_without_options() -> None:
    with pytest.raises(ValueError, match="declares no options"):
        FieldSpec(name="mode", label="Mode", kind=FieldKind.SELECT)


def test_field_spec_rejects_sequence_kind_without_options() -> None:
    with pytest.raises(ValueError, match="declares no options"):
        FieldSpec(name="rolls", label="Rolls", kind=FieldKind.SEQUENCE)


def test_field_spec_allows_a_kind_that_takes_no_options_to_omit_them() -> None:
    field = FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0)
    assert field.options is None


def test_output_spec_short_label_and_primary_default_to_unset() -> None:
    output = OutputSpec(name="total", label="Total")
    assert output.short_label is None
    assert output.primary is False


def test_field_spec_short_label_defaults_to_unset() -> None:
    field = FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER)
    assert field.short_label is None


def test_card_metadata_allows_a_single_primary_output() -> None:
    card = CardMetadata(
        id="test-card",
        name="Test Card",
        rules_text="...",
        fields=[],
        outputs=[OutputSpec(name="total", label="Total", primary=True)],
    )
    assert card.outputs[0].primary is True


def test_card_metadata_rejects_more_than_one_primary_output() -> None:
    with pytest.raises(ValueError, match="multiple primary outputs"):
        CardMetadata(
            id="test-card",
            name="Test Card",
            rules_text="...",
            fields=[],
            outputs=[
                OutputSpec(name="a", label="A", primary=True),
                OutputSpec(name="b", label="B", primary=True),
            ],
        )


def _mapped_field(**overrides: object) -> dict[str, object]:
    """A minimal two-room mapped sequence, overridable per test."""
    base: dict[str, object] = {
        "name": "path",
        "label": "Path",
        "kind": FieldKind.SEQUENCE,
        "default": [],
        "options": [
            SelectOption(value="entry", label="Entry"),
            SelectOption(value="hall", label="Hall"),
        ],
        "map": MapSpec(
            entry="entry",
            nodes=[MapNode(id="entry", column=0, row=0), MapNode(id="hall", column=1, row=0)],
            edges=[MapEdge(source="entry", target="hall")],
        ),
    }
    base.update(overrides)
    return base


def test_field_spec_accepts_a_well_formed_map() -> None:
    field = FieldSpec(**_mapped_field())
    assert field.map is not None
    assert field.map.entry == "entry"


def test_map_requires_a_sequence_field() -> None:
    with pytest.raises(ValueError, match="declares map but is kind"):
        FieldSpec(**_mapped_field(kind=FieldKind.SELECT, default="entry"))


def test_map_and_roll_are_mutually_exclusive() -> None:
    with pytest.raises(ValueError, match="both map and roll"):
        FieldSpec(
            **_mapped_field(
                options=[
                    SelectOption(value="entry", label="Entry"),
                    SelectOption(value="hall", label="Hall"),
                    SelectOption(value="1", label="1"),
                    SelectOption(value="2", label="2"),
                ],
                map=MapSpec(
                    entry="entry",
                    nodes=[
                        MapNode(id="entry", column=0, row=0),
                        MapNode(id="hall", column=1, row=0),
                        MapNode(id="1", column=2, row=0),
                        MapNode(id="2", column=3, row=0),
                    ],
                    edges=[],
                ),
                roll=RollSpec(faces=2),
            )
        )


def test_map_nodes_must_match_the_declared_options() -> None:
    with pytest.raises(ValueError, match="must match its options"):
        FieldSpec(
            **_mapped_field(
                map=MapSpec(
                    entry="entry",
                    nodes=[MapNode(id="entry", column=0, row=0)],
                    edges=[],
                )
            )
        )


def test_map_entry_must_be_a_node() -> None:
    with pytest.raises(ValueError, match="is not a node"):
        FieldSpec(
            **_mapped_field(
                map=MapSpec(
                    entry="elsewhere",
                    nodes=[
                        MapNode(id="entry", column=0, row=0),
                        MapNode(id="hall", column=1, row=0),
                    ],
                    edges=[],
                )
            )
        )


def test_map_edges_must_reference_declared_rooms() -> None:
    with pytest.raises(ValueError, match="references an undeclared room"):
        FieldSpec(
            **_mapped_field(
                map=MapSpec(
                    entry="entry",
                    nodes=[
                        MapNode(id="entry", column=0, row=0),
                        MapNode(id="hall", column=1, row=0),
                    ],
                    edges=[MapEdge(source="entry", target="basement")],
                )
            )
        )


def test_card_metadata_allows_a_shaped_primary_hero() -> None:
    card = CardMetadata(
        id="test-card",
        name="Test Card",
        rules_text="...",
        fields=[],
        outputs=[OutputSpec(name="loyalty", label="Loyalty", primary=True, hero_shape="shield")],
    )
    assert card.outputs[0].hero_shape == "shield"


def test_card_metadata_rejects_hero_shape_on_a_non_primary_output() -> None:
    # A shield on an equal-weight stat tile would silently never render; the schema
    # refuses it at import time instead.
    with pytest.raises(ValueError, match="hero_shape on non-primary"):
        CardMetadata(
            id="test-card",
            name="Test Card",
            rules_text="...",
            fields=[],
            outputs=[
                OutputSpec(name="a", label="A", primary=True),
                OutputSpec(name="b", label="B", hero_shape="shield"),
            ],
        )


def test_card_metadata_allows_a_hidden_guard_feed_output() -> None:
    card = CardMetadata(
        id="test-card",
        name="Test Card",
        rules_text="...",
        fields=[],
        outputs=[
            OutputSpec(name="tally", label="Tally", primary=True),
            OutputSpec(name="at_threshold", label="At the threshold", hidden=True),
        ],
    )
    assert card.outputs[1].hidden is True


def test_card_metadata_rejects_a_hidden_explicit_primary() -> None:
    with pytest.raises(ValueError, match="hides its hero output"):
        CardMetadata(
            id="test-card",
            name="Test Card",
            rules_text="...",
            fields=[],
            outputs=[OutputSpec(name="tally", label="Tally", primary=True, hidden=True)],
        )


def test_card_metadata_rejects_a_hidden_implicit_hero() -> None:
    # With no explicit primary, the first output is the hero -- hiding it would
    # headline the screen with a value the flag says not to render.
    with pytest.raises(ValueError, match="hides its hero output"):
        CardMetadata(
            id="test-card",
            name="Test Card",
            rules_text="...",
            fields=[],
            outputs=[
                OutputSpec(name="a", label="A", hidden=True),
                OutputSpec(name="b", label="B"),
            ],
        )


def test_card_metadata_alert_defaults_to_none() -> None:
    card = CardMetadata(id="test-card", name="Test Card", rules_text="...", fields=[], outputs=[])
    assert card.alert is None


def test_card_metadata_accepts_an_alert_spec() -> None:
    card = CardMetadata(
        id="test-card",
        name="Test Card",
        rules_text="...",
        fields=[],
        outputs=[],
        alert=AlertSpec(output="game_lost", message="You lose"),
    )
    assert card.alert is not None
    assert card.alert.output == "game_lost"
    assert card.alert.message == "You lose"


def _faces(count: int) -> list[SelectOption]:
    return [SelectOption(value=str(face), label=str(face)) for face in range(1, count + 1)]


def test_field_spec_accepts_a_rolled_sequence_covering_every_face() -> None:
    field = FieldSpec(
        name="rolls",
        label="Rolls",
        kind=FieldKind.SEQUENCE,
        options=_faces(6),
        roll=RollSpec(faces=6),
    )
    assert field.roll is not None
    assert field.roll.faces == 6
    # The label is generic unless a card overrides it.
    assert field.roll.action_label == "Roll"


def test_field_spec_rejects_a_rolled_sequence_missing_a_face() -> None:
    # A d6 whose options stop at 5 can roll a value the log cannot label and
    # validate_inputs would reject -- so it is caught at import, not at runtime.
    with pytest.raises(ValueError, match="no option for face\(s\) 6"):
        FieldSpec(
            name="rolls",
            label="Rolls",
            kind=FieldKind.SEQUENCE,
            options=_faces(5),
            roll=RollSpec(faces=6),
        )


def test_field_spec_reports_every_missing_face_at_once() -> None:
    with pytest.raises(ValueError, match="no option for face\(s\) 4, 5, 6"):
        FieldSpec(
            name="rolls",
            label="Rolls",
            kind=FieldKind.SEQUENCE,
            options=_faces(3),
            roll=RollSpec(faces=6),
        )


def test_field_spec_rejects_roll_on_a_non_sequence_kind() -> None:
    with pytest.raises(ValueError, match="declares roll but is kind"):
        FieldSpec(name="count", label="Count", kind=FieldKind.COUNTER, roll=RollSpec(faces=6))


def test_field_spec_roll_defaults_to_none() -> None:
    field = FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0)
    assert field.roll is None


def test_card_metadata_rejects_a_carry_over_naming_a_missing_output() -> None:
    with pytest.raises(ValueError, match="carries undeclared outputs"):
        CardMetadata(
            id="test-card",
            name="Test Card",
            rules_text="...",
            fields=[
                FieldSpec(
                    name="start",
                    label="Start",
                    kind=FieldKind.NUMBER,
                    new_turn_carries_output="ghost",
                )
            ],
            outputs=[OutputSpec(name="total", label="Total")],
        )


def test_card_metadata_accepts_a_carry_over_naming_a_declared_output() -> None:
    card = CardMetadata(
        id="test-card",
        name="Test Card",
        rules_text="...",
        fields=[
            FieldSpec(
                name="start", label="Start", kind=FieldKind.NUMBER, new_turn_carries_output="total"
            )
        ],
        outputs=[OutputSpec(name="total", label="Total")],
    )
    assert card.fields[0].new_turn_carries_output == "total"


def test_art_box_accepts_a_box_inside_the_card() -> None:
    box = ArtBox(x=0.1, y=0.2, w=0.5, h=0.3)
    assert box.w == 0.5


def test_art_box_rejects_out_of_range_values() -> None:
    with pytest.raises(ValueError, match="out of range"):
        ArtBox(x=-0.1, y=0.2, w=0.5, h=0.3)
    with pytest.raises(ValueError, match="out of range"):
        ArtBox(x=0.1, y=0.2, w=0.0, h=0.3)


def test_art_box_rejects_a_box_hanging_off_the_card() -> None:
    with pytest.raises(ValueError, match="exceeds the card"):
        ArtBox(x=0.8, y=0.2, w=0.5, h=0.3)


def test_map_spec_with_a_card_requires_art_on_every_room() -> None:
    with pytest.raises(ValueError, match="missing art boxes"):
        MapSpec(
            entry="a",
            scryfall_id="59b11ff8-f118-4978-87dd-509dc0c8c932",
            nodes=[
                MapNode(id="a", column=0, row=0, art=ArtBox(x=0.1, y=0.1, w=0.5, h=0.2)),
                MapNode(id="b", column=1, row=0),
            ],
            edges=[MapEdge(source="a", target="b")],
        )


def test_map_spec_without_a_card_rejects_stray_art() -> None:
    # An art box with no card to draw it on is a stranded annotation.
    with pytest.raises(ValueError, match="art boxes but no card"):
        MapSpec(
            entry="a",
            nodes=[MapNode(id="a", column=0, row=0, art=ArtBox(x=0.1, y=0.1, w=0.5, h=0.2))],
            edges=[],
        )


def test_map_spec_with_full_art_is_accepted() -> None:
    spec = MapSpec(
        entry="a",
        scryfall_id="59b11ff8-f118-4978-87dd-509dc0c8c932",
        nodes=[
            MapNode(id="a", column=0, row=0, art=ArtBox(x=0.1, y=0.1, w=0.5, h=0.2)),
            MapNode(id="b", column=1, row=0, art=ArtBox(x=0.1, y=0.4, w=0.5, h=0.2)),
        ],
        edges=[MapEdge(source="a", target="b")],
    )
    assert spec.scryfall_id is not None
