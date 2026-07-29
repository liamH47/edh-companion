import pytest

from app.cards.schema import FieldKind, FieldSpec


def test_field_spec_rejects_select_kind_without_options() -> None:
    with pytest.raises(ValueError, match="declares no options"):
        FieldSpec(name="mode", label="Mode", kind=FieldKind.SELECT)
