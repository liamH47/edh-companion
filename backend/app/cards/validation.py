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
        case FieldKind.SELECT:
            return _validate_select(field, value)
        case FieldKind.SEQUENCE:  # pragma: no branch -- exhaustive over FieldKind's 5 members
            return _validate_sequence(field, value)


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


def _validate_sequence(field: FieldSpec, value: Any) -> list[str]:
    """Order-preserving list of `options` values, capped at `max` entries.

    Returns a *copy*: a sequence field's default is a shared list living on the
    module-level METADATA singleton, so handing it straight back would let one
    request's inputs alias every later request's default.
    """
    if not isinstance(value, list):
        raise ValueError(f"{field.name!r} must be a list, got {value!r}")
    if field.max is not None and len(value) > field.max:
        raise ValueError(f"{field.name!r} must have at most {field.max} entries, got {len(value)}")
    allowed = {option.value for option in field.options or []}
    for entry in value:
        if entry not in allowed:
            raise ValueError(
                f"{field.name!r} entries must each be one of {sorted(allowed)}, got {entry!r}"
            )
    return list(value)
