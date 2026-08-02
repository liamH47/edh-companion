import pytest

from app.cards.schema import FieldKind, FieldSpec, SelectOption
from app.cards.validation import validate_inputs


def test_validate_inputs_applies_default_for_omitted_field() -> None:
    fields = [
        FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=5, min=0, max=10)
    ]
    assert validate_inputs(fields, {}) == {"count": 5}


def test_validate_inputs_rejects_boolean_field_with_non_boolean_value() -> None:
    fields = [FieldSpec(name="flag", label="Flag", kind=FieldKind.BOOLEAN, default=True)]
    with pytest.raises(ValueError, match="must be a boolean"):
        validate_inputs(fields, {"flag": "yes"})


def test_validate_inputs_rejects_number_field_below_min() -> None:
    fields = [
        FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0, min=1, max=10)
    ]
    with pytest.raises(ValueError, match="must be >= 1"):
        validate_inputs(fields, {"count": 0})


def test_validate_inputs_rejects_number_field_above_max() -> None:
    fields = [
        FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0, min=0, max=10)
    ]
    with pytest.raises(ValueError, match="must be <= 10"):
        validate_inputs(fields, {"count": 11})


def test_validate_inputs_rejects_non_integer_number_field() -> None:
    fields = [FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0)]
    with pytest.raises(ValueError, match="must be an integer"):
        validate_inputs(fields, {"count": 1.5})


def test_validate_inputs_rejects_boolean_value_for_number_field() -> None:
    fields = [FieldSpec(name="count", label="Count", kind=FieldKind.NUMBER, default=0)]
    with pytest.raises(ValueError, match="must be an integer"):
        validate_inputs(fields, {"count": True})


def test_validate_inputs_accepts_valid_select_value() -> None:
    fields = [
        FieldSpec(
            name="mode",
            label="Mode",
            kind=FieldKind.SELECT,
            default="a",
            options=[SelectOption(value="a", label="A"), SelectOption(value="b", label="B")],
        )
    ]
    assert validate_inputs(fields, {"mode": "b"}) == {"mode": "b"}


def test_validate_inputs_rejects_select_value_not_in_options() -> None:
    fields = [
        FieldSpec(
            name="mode",
            label="Mode",
            kind=FieldKind.SELECT,
            default="a",
            options=[SelectOption(value="a", label="A")],
        )
    ]
    with pytest.raises(ValueError, match="must be one of"):
        validate_inputs(fields, {"mode": "z"})


def test_validate_inputs_rejects_non_string_select_value() -> None:
    fields = [
        FieldSpec(
            name="mode",
            label="Mode",
            kind=FieldKind.SELECT,
            default="a",
            options=[SelectOption(value="a", label="A")],
        )
    ]
    with pytest.raises(ValueError, match="must be a string"):
        validate_inputs(fields, {"mode": 1})


def _sequence_field(*, max_entries: int | None = None) -> FieldSpec:
    return FieldSpec(
        name="rolls",
        label="Rolls",
        kind=FieldKind.SEQUENCE,
        default=[],
        max=max_entries,
        options=[SelectOption(value="a", label="A"), SelectOption(value="b", label="B")],
    )


def test_validate_inputs_accepts_a_sequence_of_option_values_in_order() -> None:
    fields = [_sequence_field()]
    assert validate_inputs(fields, {"rolls": ["b", "a", "b"]}) == {"rolls": ["b", "a", "b"]}


def test_validate_inputs_accepts_an_empty_sequence() -> None:
    assert validate_inputs([_sequence_field()], {"rolls": []}) == {"rolls": []}


def test_validate_inputs_rejects_a_non_list_sequence_value() -> None:
    with pytest.raises(ValueError, match="must be a list"):
        validate_inputs([_sequence_field()], {"rolls": "a"})


def test_validate_inputs_rejects_a_sequence_entry_not_in_options() -> None:
    with pytest.raises(ValueError, match="entries must each be one of"):
        validate_inputs([_sequence_field()], {"rolls": ["a", "z"]})


def test_validate_inputs_rejects_a_sequence_longer_than_max() -> None:
    with pytest.raises(ValueError, match="at most 2 entries"):
        validate_inputs([_sequence_field(max_entries=2)], {"rolls": ["a", "a", "a"]})


def test_validate_inputs_accepts_a_sequence_exactly_at_max() -> None:
    fields = [_sequence_field(max_entries=2)]
    assert validate_inputs(fields, {"rolls": ["a", "b"]}) == {"rolls": ["a", "b"]}


def test_validate_inputs_copies_a_sequence_so_the_shared_default_cannot_be_mutated() -> None:
    # A sequence field's default is one list object living on a module-level METADATA
    # singleton. Handing it straight back would let a caller mutating its own inputs
    # silently change the default every later request falls back to.
    field = _sequence_field()
    validated = validate_inputs([field], {})
    validated["rolls"].append("a")
    assert field.default == []
    assert validate_inputs([field], {}) == {"rolls": []}
