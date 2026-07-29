"""Generic input validation shared by every card, driven entirely by FieldSpec.

Lives once, here, so a new card never needs to write its own bounds/type checks.
"""

from typing import Any

from .schema import FieldKind, FieldSpec


def validate_inputs(fields: list[FieldSpec], raw_inputs: dict[str, Any]) -> dict[str, Any]:
    """Apply each field's default for omitted keys, then type/bounds-check every value."""
    return {
        field.name: _validate_field(field, raw_inputs.get(field.name, field.default))
        for field in fields
    }


def _validate_field(field: FieldSpec, value: Any) -> Any:
    match field.kind:
        case FieldKind.BOOLEAN:
            return _validate_boolean(field, value)
        case FieldKind.NUMBER | FieldKind.COUNTER:
            return _validate_number(field, value)
        case FieldKind.SELECT:  # pragma: no branch -- exhaustive over FieldKind's 4 members
            return _validate_select(field, value)


def _validate_boolean(field: FieldSpec, value: Any) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{field.name!r} must be a boolean, got {value!r}")
    return value


def _validate_number(field: FieldSpec, value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field.name!r} must be an integer, got {value!r}")
    if field.min is not None and value < field.min:
        raise ValueError(f"{field.name!r} must be >= {field.min}, got {value}")
    if field.max is not None and value > field.max:
        raise ValueError(f"{field.name!r} must be <= {field.max}, got {value}")
    return value


def _validate_select(field: FieldSpec, value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field.name!r} must be a string, got {value!r}")
    allowed = {option.value for option in field.options or []}
    if value not in allowed:
        raise ValueError(f"{field.name!r} must be one of {sorted(allowed)}, got {value!r}")
    return value
