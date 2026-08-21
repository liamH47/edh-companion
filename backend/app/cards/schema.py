"""Pydantic contract shared by every card: metadata a frontend can render generically."""

from enum import StrEnum
from typing import Any, Literal

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


class ArtBox(BaseModel):
    """Where a room sits on the printed card image, as fractions of its width/height.
    Lets the frontend draw the venture marker over the card's own room box."""

    x: float
    y: float
    w: float
    h: float

    @model_validator(mode="after")
    def _check_inside_the_card(self) -> "ArtBox":
        if not (0 <= self.x <= 1 and 0 <= self.y <= 1 and 0 < self.w <= 1 and 0 < self.h <= 1):
            raise ValueError(f"art box out of range: {self}")
        if self.x + self.w > 1.0001 or self.y + self.h > 1.0001:
            raise ValueError(f"art box exceeds the card: {self}")
        return self


class MapNode(BaseModel):
    """One room on a dungeon map. `column` is depth into the dungeon (0 = the entry,
    rendered top-to-bottom); `row` places siblings left-to-right within a column.
    `art` is the room's box on the printed card, when the map has one to show."""

    id: str
    column: int
    row: int
    art: ArtBox | None = None


class MapEdge(BaseModel):
    source: str
    target: str


class MapSpec(BaseModel):
    """Marks a `sequence` field as a walk through a room graph, rendered as a tappable
    map rather than a chip log. The value stays a plain ordered list of room ids --
    compute() reads it exactly like Comet reads its rolls and never learns about the
    map, the same doctrine that keeps RollSpec's die out of the pure function.

    A room with no outgoing edges IS the bottom room; there is deliberately no
    `terminal` flag, which would be a second source of truth the card module could
    drift out of sync with itself."""

    entry: str
    nodes: list[MapNode]
    edges: list[MapEdge]
    # The printed dungeon card this map depicts. When set, every node must carry an
    # `art` box (all or nothing -- a half-annotated card would strand the marker), and
    # the frontend renders the real card with the position overlaid, falling back to
    # the drawn map offline.
    scryfall_id: str | None = None

    @model_validator(mode="after")
    def _check_art_is_all_or_nothing(self) -> "MapSpec":
        annotated = [node.id for node in self.nodes if node.art is not None]
        if self.scryfall_id is not None and len(annotated) != len(self.nodes):
            missing = [node.id for node in self.nodes if node.art is None]
            raise ValueError(f"map with card art is missing art boxes for rooms: {missing}")
        if self.scryfall_id is None and annotated:
            raise ValueError(f"map declares art boxes but no card: {annotated}")
        return self


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
    # See MapSpec: this sequence is a walk through a room graph, rendered as a map.
    # Only meaningful on a sequence field; mutually exclusive with roll.
    map: MapSpec | None = None
    # On "New turn", this field takes the named output's final value instead of its
    # default -- state that persists across turns rather than resetting (Comet's
    # loyalty: the walker keeps the counters it ended the turn with). Frontend-only,
    # like default_source; compute() never knows where the value came from. The carried
    # value is clamped to the field's own min/max so a runaway output cannot poison the
    # next turn's validation.
    new_turn_carries_output: str | None = None
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

    @model_validator(mode="after")
    def _check_map_is_a_walkable_sequence(self) -> "FieldSpec":
        """A map must be renderable and walkable from its own declaration: sequence
        kind only, never combined with roll, and every id it mentions -- entry, node,
        edge endpoint -- must be a declared option value, so the chip log, the
        validator and the map can never disagree about what a room is called."""
        if self.map is None:
            return self
        if self.kind is not FieldKind.SEQUENCE:
            raise ValueError(f"field {self.name!r} declares map but is kind={self.kind}")
        if self.roll is not None:
            raise ValueError(f"field {self.name!r} declares both map and roll")
        declared = {option.value for option in self.options or []}
        node_ids = {node.id for node in self.map.nodes}
        if node_ids != declared:
            raise ValueError(
                f"field {self.name!r} map nodes {sorted(node_ids)} "
                f"must match its options {sorted(declared)}"
            )
        if self.map.entry not in node_ids:
            raise ValueError(f"field {self.name!r} map entry {self.map.entry!r} is not a node")
        for edge in self.map.edges:
            if edge.source not in node_ids or edge.target not in node_ids:
                raise ValueError(
                    f"field {self.name!r} map edge {edge.source!r}->{edge.target!r} "
                    "references an undeclared room"
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
    # How the hero renders this output, when it is the primary. "number" is the plain
    # HeroStat; "shield" draws a planeswalker loyalty shield around it (Comet). A visual
    # shape, deliberately not part of OutputKind -- that enum is the value's data type,
    # and coupling presentation to it would make every kind branch also carry
    # presentation. Frontend-only, like `primary`; compute() knows nothing of it.
    hero_shape: Literal["number", "shield"] = "number"
    # Computed but never rendered as a stat tile. For outputs that exist to feed
    # machinery -- an ActionGuard threshold, an AlertSpec boolean -- whose value the
    # player already sees expressed elsewhere (the guard enabling, the banner firing).
    # Dungeons' `at_bottom_room` was the motivating case: a 0/1 tile saying what the
    # map's marker and the completion banner both already say. Frontend-only, like
    # `primary`; compute() still returns the value and validation still checks it.
    hidden: bool = False


class AlertSpec(BaseModel):
    """Names a boolean compute() output that should drive a banner instead of another
    stat tile -- e.g. Aetherflux's `game_lost`. Frontend-only concern; compute() just
    returns the named boolean like any other output.

    `tone` decides how the moment sounds and reads: "danger" (a loss -- Aetherflux's
    game_lost, Comet dying) takes the danger banner and the lose sound; "success"
    (a dungeon completed) takes the accent banner and the win sound. Completing a
    dungeon sounding like losing a coin flip was the bug that forced the split."""

    output: str
    message: str
    tone: Literal["danger", "success"] = "danger"


class CardMetadata(BaseModel):
    id: str
    name: str
    rules_text: str
    # Scryfall print id, used to build the card-image URL the "View card" button opens.
    # Optional: a future entry could be a format mechanic (commander tax) with no card
    # behind it, and the button simply does not render for those.
    scryfall_id: str | None = None
    # Show the card image inline on the calculator screen, beside the hero, instead of
    # only behind the "View card" button. The screen must keep working without it --
    # the image is the one thing in the app that needs a network -- so the frontend
    # reuses CardImage's graceful fallback, and cardless entries are safe by
    # construction (no scryfall_id, no image, flag ignored).
    show_hero_art: bool = False
    # Whether the "New turn" reset button makes sense for this card. Most cards track a
    # single turn (Aetherflux's spells this turn) and reset between turns; a game-long
    # tracker (commander tax's cast count, dungeons' completed tally) has no turn
    # boundary to reset at, and offering the button quietly erases state the player
    # cannot reconstruct. Frontend-only: ActionBar hides the button when False.
    resets_on_new_turn: bool = True
    fields: list[FieldSpec]
    outputs: list[OutputSpec]
    alert: AlertSpec | None = None

    @model_validator(mode="after")
    def _check_at_most_one_primary_output(self) -> "CardMetadata":
        primary_names = [output.name for output in self.outputs if output.primary]
        if len(primary_names) > 1:
            raise ValueError(f"card {self.id!r} declares multiple primary outputs: {primary_names}")
        return self

    @model_validator(mode="after")
    def _check_carried_outputs_exist(self) -> "CardMetadata":
        """A carry-over naming a missing output would silently fall back to the
        default -- exactly the quiet reset the flag exists to prevent."""
        declared = {output.name for output in self.outputs}
        bad = [
            f.name
            for f in self.fields
            if f.new_turn_carries_output is not None and f.new_turn_carries_output not in declared
        ]
        if bad:
            raise ValueError(f"card {self.id!r} carries undeclared outputs on fields: {bad}")
        return self

    @model_validator(mode="after")
    def _check_hero_output_is_visible(self) -> "CardMetadata":
        """The hero slot is the explicit primary, else the first output -- hiding that
        one would leave the screen headlining a value the flag says not to render."""
        hero = next((o for o in self.outputs if o.primary), None)
        if hero is None and self.outputs:
            hero = self.outputs[0]
        if hero is not None and hero.hidden:
            raise ValueError(f"card {self.id!r} hides its hero output: {hero.name!r}")
        return self

    @model_validator(mode="after")
    def _check_hero_shape_is_primary(self) -> "CardMetadata":
        """A shaped hero only means something on the primary output -- a shield on an
        equal-weight stat tile would silently never render, which is the kind of quiet
        misconfiguration a card author should hear about at import time."""
        shaped = [o.name for o in self.outputs if o.hero_shape != "number" and not o.primary]
        if shaped:
            raise ValueError(
                f"card {self.id!r} declares hero_shape on non-primary outputs: {shaped}"
            )
        return self
