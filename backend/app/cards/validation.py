"""Generic input validation shared by every card, driven entirely by FieldSpec.

Lives once, here, so a new card never needs to write its own bounds/type checks.
"""

from typing import Any

from .schema import FieldKind, FieldSpec


class InputError(ValueError):
    """A validation failure carrying a machine-readable code beside its message.

    The code exists for the TypeScript parity corpus. Asserting that both
    implementations produce the same *message* is a trap: these embed ``{value!r}``,
    and Python renders ``True``/``'x'`` where JavaScript renders ``true``/``"x"`` --
    so message equality would mean hand-writing a Python ``repr`` in TypeScript
    forever, and would break on values nobody thought about.

    The message itself is unchanged, so the API's 422 body and every existing test
    still see exactly what they did before.
    """

    def __init__(self, field: str, code: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.code = code


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
        raise InputError(
            field.name, "not_boolean", f"{field.name!r} must be a boolean, got {value!r}"
        )
    return value


def _validate_number(field: FieldSpec, value: Any) -> int:
    # bool is a subclass of int in Python, so True would otherwise pass as 1. No such
    # hazard exists in the TypeScript port, which is exactly why the corpus compares
    # error *codes* rather than trying to mirror this check.
    if isinstance(value, bool) or not isinstance(value, int):
        raise InputError(
            field.name, "not_integer", f"{field.name!r} must be an integer, got {value!r}"
        )
    if field.min is not None and value < field.min:
        raise InputError(
            field.name, "below_min", f"{field.name!r} must be >= {field.min}, got {value}"
        )
    if field.max is not None and value > field.max:
        raise InputError(
            field.name, "above_max", f"{field.name!r} must be <= {field.max}, got {value}"
        )
    return value


def _validate_select(field: FieldSpec, value: Any) -> str:
    if not isinstance(value, str):
        raise InputError(
            field.name, "not_string", f"{field.name!r} must be a string, got {value!r}"
        )
    allowed = {option.value for option in field.options or []}
    if value not in allowed:
        raise InputError(
            field.name,
            "not_in_options",
            f"{field.name!r} must be one of {sorted(allowed)}, got {value!r}",
        )
    return value


def _validate_sequence(field: FieldSpec, value: Any) -> list[str]:
    """Order-preserving list of `options` values, capped at `max` entries.

    Returns a *copy*: a sequence field's default is a shared list living on the
    module-level METADATA singleton, so handing it straight back would let one
    request's inputs alias every later request's default.
    """
    if not isinstance(value, list):
        raise InputError(field.name, "not_list", f"{field.name!r} must be a list, got {value!r}")
    if field.max is not None and len(value) > field.max:
        raise InputError(
            field.name,
            "too_long",
            f"{field.name!r} must have at most {field.max} entries, got {len(value)}",
        )
    allowed = {option.value for option in field.options or []}
    for entry in value:
        if entry not in allowed:
            raise InputError(
                field.name,
                "entry_not_in_options",
                f"{field.name!r} entries must each be one of {sorted(allowed)}, got {entry!r}",
            )
    if field.map is not None:
        _validate_walk(field, value)
    return list(value)


def _validate_walk(field: FieldSpec, value: list[str]) -> None:
    """A mapped sequence must be a legal walk: start at the entry, then follow an
    edge for every step. Venture never moves backwards or teleports (CR 309), and the
    UI only offers legal successors -- so this rejects only a hand-crafted request,
    the same defensive posture the membership check above already takes."""
    assert field.map is not None  # narrowed by the caller; mypy cannot see it
    if not value:
        return
    if value[0] != field.map.entry:
        raise InputError(
            field.name,
            "illegal_room",
            f"{field.name!r} must start at {field.map.entry!r}, got {value[0]!r}",
        )
    successors: dict[str, set[str]] = {}
    for edge in field.map.edges:
        successors.setdefault(edge.source, set()).add(edge.target)
    for previous, current in zip(value, value[1:], strict=False):
        if current not in successors.get(previous, set()):
            raise InputError(
                field.name,
                "illegal_room",
                f"{field.name!r} cannot move from {previous!r} to {current!r}",
            )
