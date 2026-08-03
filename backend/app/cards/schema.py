"""Pydantic contract shared by every card: metadata a frontend can render generically."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, model_validator


class FieldKind(StrEnum):
    NUMBER = "number"
    BOOLEAN = "boolean"
    SELECT = "select"
    COUNTER = "counter"
    # An *ordered* list of `options` values, e.g. Comet's die rolls. Distinct from a
    # set of per-outcome counters because order changes the answer: Comet's 4-5 branch
    # deals damage equal to his loyalty at that moment, so an earlier +2 roll makes a
    # later damage roll bigger. `options` holds the allowed entries and `max` caps the
    # list's length -- no extra FieldSpec attributes needed.
    SEQUENCE = "sequence"


# Kinds whose allowed values come from `options`, and so can't be declared without them.
_OPTION_KINDS = frozenset({FieldKind.SELECT, FieldKind.SEQUENCE})


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


class RollSpec(BaseModel):
    """Marks a `sequence` field as rolled *by the app* rather than picked by the player:
    the UI shows one roll button instead of one button per option, generates a face,
    animates it, and appends the result to the log.

    Frontend-only, like ActionGuard: compute() receives the resulting sequence exactly
    as it would if the player had tapped the entries by hand, and never learns where
    the values came from. That keeps the die out of the pure function -- randomness
    lives at the edge, so compute() stays trivially testable.

    The field's `options` must declare one entry per face, valued "1".."faces", so the
    log can label what was actually rolled rather than which branch it fell into."""

    faces: int
    action_label: str = "Roll"


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
    # See RollSpec. Only meaningful on a sequence field.
    roll: RollSpec | None = None
    # Marks a field as one-time board-state setup (answered once, rarely revisited) rather
    # than something clicked repeatedly during play. Setup fields render inside a collapsible
    # section the player can tuck away once answered, keeping the fields they actually
    # interact with all turn (counters, action buttons) visible without scrolling on mobile.
    setup: bool = False
    # Short form of `label` for space-constrained UI (a setup summary chip). Falls back
    # to `label` when unset -- optional so existing cards don't need to declare it.
    short_label: str | None = None

    @model_validator(mode="after")
    def _check_option_kinds_have_options(self) -> "FieldSpec":
        if self.kind in _OPTION_KINDS and not self.options:
            raise ValueError(f"field {self.name!r} is kind={self.kind} but declares no options")
        return self

    @model_validator(mode="after")
    def _check_roll_covers_every_face(self) -> "FieldSpec":
        """A rolled field must be able to label any face the die can land on -- a d6
        whose options stop at 5 would roll a value the log cannot render and
        validate_inputs would reject."""
        if self.roll is None:
            return self
        if self.kind is not FieldKind.SEQUENCE:
            raise ValueError(f"field {self.name!r} declares roll but is kind={self.kind}")
        declared = {option.value for option in self.options or []}
        missing = [str(face) for face in range(1, self.roll.faces + 1) if str(face) not in declared]
        if missing:
            raise ValueError(
                f"field {self.name!r} rolls a d{self.roll.faces} "
                f"but declares no option for face(s) {', '.join(missing)}"
            )
        return self


class OutputSpec(BaseModel):
    name: str
    label: str
    kind: OutputKind = OutputKind.NUMBER
    # Short form of `label` for space-constrained UI (a stat tile). Falls back to
    # `label` when unset.
    short_label: str | None = None
    # Marks this as the card's headline result, e.g. "damage available" for Aetherflux --
    # rendered as the hero number instead of an equal-weight tile. At most one per card.
    primary: bool = False


class AlertSpec(BaseModel):
    """Names a boolean compute() output that should drive a banner instead of another
    stat tile -- e.g. Aetherflux's `game_lost`. Frontend-only concern; compute() just
    returns the named boolean like any other output."""

    output: str
    message: str


class CardMetadata(BaseModel):
    id: str
    name: str
    rules_text: str
    # Scryfall print id, used to build the card-image URL the "View card" button opens.
    # Optional: a future entry could be a format mechanic (commander tax) with no card
    # behind it, and the button simply does not render for those.
    scryfall_id: str | None = None
    fields: list[FieldSpec]
    outputs: list[OutputSpec]
    alert: AlertSpec | None = None

    @model_validator(mode="after")
    def _check_at_most_one_primary_output(self) -> "CardMetadata":
        primary_names = [output.name for output in self.outputs if output.primary]
        if len(primary_names) > 1:
            raise ValueError(f"card {self.id!r} declares multiple primary outputs: {primary_names}")
        return self
