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
  setup: boolean
  short_label: string | null
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
  fields: FieldSpec[]
  outputs: OutputSpec[]
  alert: AlertSpec | null
}

export type FieldValues = Record<string, unknown>
export type OutputValues = Record<string, unknown>
