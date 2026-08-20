export type FieldKind = 'number' | 'boolean' | 'select' | 'counter' | 'sequence'

export interface SelectOption {
  value: string
  label: string
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
  /** On "New turn", this field takes the named output's final value (clamped to the
   * field's own bounds) instead of its default -- state that persists across turns
   * (Comet's loyalty). Frontend-only; compute() never knows where the value came from. */
  new_turn_carries_output: string | null
  setup: boolean
  short_label: string | null
}

export interface MapNode {
  id: string
  /** Depth into the dungeon: 0 = the entry, rendered top-to-bottom. */
  column: number
  /** Left-to-right position among siblings within a column. */
  row: number
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
}

export interface OutputSpec {
  name: string
  label: string
  kind: 'number' | 'text'
  short_label: string | null
  primary: boolean
  /** How the hero renders this output when it is the primary: the plain HeroStat, or a
   * planeswalker loyalty shield (Comet). Presentation only -- deliberately not part of
   * `kind`, which is the value's data type. */
  hero_shape: 'number' | 'shield'
}

export interface AlertSpec {
  output: string
  message: string
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
