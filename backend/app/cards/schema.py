"""Pydantic contract shared by every card: metadata a frontend can render generically."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, model_validator


class FieldKind(StrEnum):
    NUMBER = "number"
    BOOLEAN = "boolean"
    SELECT = "select"
    COUNTER = "counter"


class OutputKind(StrEnum):
    NUMBER = "number"
    TEXT = "text"


class SelectOption(BaseModel):
    value: str
    label: str


class VisibleIf(BaseModel):
    field: str
    equals: Any


class ActionGuard(BaseModel):
    """Disables a counter field's action button when a named *output* (not another
    input field) drops below a threshold -- e.g. can't click "Pay 50 Life" once
    current_life is under 50. Evaluated against the most recent calculate() result,
    since the guard is about affordability, not the field's own value/bounds."""

    output: str
    less_than: int | float


class FieldSpec(BaseModel):
    name: str
    label: str
    kind: FieldKind
    default: Any = None
    min: int | float | None = None
    max: int | float | None = None
    options: list[SelectOption] | None = None
    visible_if: VisibleIf | None = None
    help_text: str | None = None
    # Another field's name. Whenever that field's value changes, this field's value is
    # reset to match it -- e.g. a "spells cast this turn" counter that should jump to
    # match a "spells already cast" baseline the moment that baseline is set, so the
    # player doesn't have to manually re-enter it. Frontend-only behavior (see
    # CardForm's handleChange); compute() never needs to know this exists.
    default_source: str | None = None
    # Overrides the generic "+1" button label for a counter field, e.g. "Pay 50 Life"
    # for an activation-tracking counter. Ignored for non-counter kinds.
    action_label: str | None = None
    # See ActionGuard. Ignored for non-counter kinds.
    action_disabled_when: ActionGuard | None = None

    @model_validator(mode="after")
    def _check_select_has_options(self) -> "FieldSpec":
        if self.kind is FieldKind.SELECT and not self.options:
            raise ValueError(f"field {self.name!r} is kind=select but declares no options")
        return self


class OutputSpec(BaseModel):
    name: str
    label: str
    kind: OutputKind = OutputKind.NUMBER


class CardMetadata(BaseModel):
    id: str
    name: str
    rules_text: str
    fields: list[FieldSpec]
    outputs: list[OutputSpec]
