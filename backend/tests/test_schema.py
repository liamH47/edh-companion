import pytest

from app.cards.schema import AlertSpec, CardMetadata, FieldKind, FieldSpec, OutputSpec


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
