export type FieldKind = 'number' | 'boolean' | 'select' | 'counter' | 'sequence'

export interface SelectOption {
  value: string
  label: string
  /** The printed card this option stands for, when it stands for one -- lets a picker
   * show the card rather than only its name. Presentational; compute() sees only `value`. */
  scryfall_id: string | null
}

export interface VisibleIf {
  field: string
  equals: unknown
}

export interface ActionGuard {
  output: string
  less_than: number
}

/** A `sequence` field the app rolls for, rather than one the player picks from. The
 * UI shows a single roll button, generates a face in 1..faces, animates it, and
 * appends the result. See RollSpec in the backend's schema.py. */
export interface RollSpec {
  faces: number
  action_label: string
}

/** Marks a sequence field as a roster searched out of a long option list, rendered as a
 * searchable add/remove list instead of one button per option. The value stays a plain
 * ordered list of option values; adding the same option twice is how you say you control
 * two of that card. See PickerSpec in the backend's schema.py. */
export interface PickerSpec {
  search_placeholder: string
  empty_label: string
}

export interface FieldSpec {
  name: string
  label: string
  kind: FieldKind
  default: unknown
  min: number | null
  max: number | null
  options: SelectOption[] | null
  visible_if: VisibleIf | null
  help_text: string | null
  default_source: string | null
  action_label: string | null
  action_disabled_when: ActionGuard | null
  roll: RollSpec | null
  /** See MapSpec. Only on a sequence field; mutually exclusive with roll. */
  map: MapSpec | null
  /** See PickerSpec. Only on a sequence field; mutually exclusive with roll and map. */
  picker: PickerSpec | null
  /** On "New turn", this field takes the named output's final value (clamped to the
   * field's own bounds) instead of its default -- state that persists across turns
   * (Comet's loyalty). Frontend-only; compute() never knows where the value came from. */
  new_turn_carries_output: string | null
  /** "New turn" leaves this field's value alone instead of resetting it to the default --
   * board state a turn boundary does not change (the landfall permanents you control).
   * Mutually exclusive with new_turn_carries_output, which adopts a computed value. */
  persists_across_turns: boolean
  setup: boolean
  short_label: string | null
}

/** Where a room sits on the printed card image, as fractions of its width/height. */
export interface ArtBox {
  x: number
  y: number
  w: number
  h: number
}

export interface MapNode {
  id: string
  /** Depth into the dungeon: 0 = the entry, rendered top-to-bottom. */
  column: number
  /** Left-to-right position among siblings within a column. */
  row: number
  /** The room's box on the printed card, when the map has one to show. */
  art: ArtBox | null
}

export interface MapEdge {
  source: string
  target: string
}

/** Marks a sequence field as a walk through a room graph, rendered as a tappable map.
 * The value stays a plain ordered list of room ids -- compute() never sees the map,
 * the same doctrine that keeps RollSpec's die out of the pure function. A room with no
 * outgoing edges IS the bottom room; there is deliberately no terminal flag. */
export interface MapSpec {
  entry: string
  nodes: MapNode[]
  edges: MapEdge[]
  /** The printed dungeon card this map depicts. When set, every node carries an `art`
   * box and the frontend renders the real card with the position overlaid, falling
   * back to the drawn map offline. */
  scryfall_id: string | null
}

export interface OutputSpec {
  name: string
  label: string
  /** `lines` is a list of EffectLine rows rather than a single value -- what a card
   * returns when the answer is everything that happens at once (landfall's simultaneous
   * triggers). Only ever the hero; no stat tile can hold a list. */
  kind: 'number' | 'text' | 'lines'
  short_label: string | null
  primary: boolean
  /** How the hero renders this output when it is the primary: the plain HeroStat, a
   * planeswalker loyalty shield (Comet), or a list of effect rows (landfall).
   * Presentation only -- deliberately not part of `kind`, which is the value's data
   * type. `lines` and `list` are declared together or not at all. */
  hero_shape: 'number' | 'shield' | 'list'
  /** Computed but never rendered as a stat tile -- for guard/alert feeds the player
   * already sees expressed elsewhere (dungeons' `at_bottom_room`). Presentation only. */
  hidden: boolean
}

export interface AlertSpec {
  output: string
  message: string
  /** "danger" (a loss): danger banner + lose sound. "success" (a dungeon completed):
   * accent banner + win sound. Completing a dungeon must not sound like losing. */
  tone: 'danger' | 'success'
}

export interface CardMetadata {
  id: string
  name: string
  rules_text: string
  /** Scryfall print id, or null for an entry with no card behind it. See cardImage.ts. */
  scryfall_id: string | null
  /** Show the card image inline beside the hero, not only behind "View card". The
   * screen must keep working without the image (CardImage's fallback). */
  show_hero_art: boolean
  /** Whether the "New turn" reset button makes sense for this card. False for a
   * game-long tracker (commander tax, dungeons); ActionBar hides the button. */
  resets_on_new_turn: boolean
  fields: FieldSpec[]
  outputs: OutputSpec[]
  alert: AlertSpec | null
}

export type FieldValues = Record<string, unknown>
export type OutputValues = Record<string, unknown>

/** One row of a `lines` output: which permanent, what it does per resolution, and what
 * that has come to this turn. Produced by compute() on both sides, so the corpus locks
 * the wording; `effectLines` in cardModel.ts is the safe way to read one back. */
export interface EffectLine {
  source: string
  effect: string
  note: string
}
