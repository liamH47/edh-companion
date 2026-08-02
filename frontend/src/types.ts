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
  setup: boolean
  short_label: string | null
}

export interface OutputSpec {
  name: string
  label: string
  kind: 'number' | 'text'
  short_label: string | null
  primary: boolean
}

export interface AlertSpec {
  output: string
  message: string
}

export interface CardMetadata {
  id: string
  name: string
  rules_text: string
  fields: FieldSpec[]
  outputs: OutputSpec[]
  alert: AlertSpec | null
}

export type FieldValues = Record<string, unknown>
export type OutputValues = Record<string, unknown>
