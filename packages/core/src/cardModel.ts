import type { CardMetadata, FieldSpec, FieldValues, OutputSpec, OutputValues } from './types'

export function defaultValues(card: CardMetadata): FieldValues {
  const values: FieldValues = {}
  for (const field of card.fields) {
    values[field.name] = field.default
  }
  return values
}

export function isFieldVisible(field: FieldSpec, values: FieldValues): boolean {
  if (!field.visible_if) return true
  return values[field.visible_if.field] === field.visible_if.equals
}

/**
 * Applies two generic, schema-driven adjustments on top of a raw field change:
 *  - a field that just became hidden (visible_if no longer satisfied) resets to its
 *    default, so it can't leave a stale value behind for anything sourcing from it
 *  - a field with default_source re-syncs to that source field's value whenever the
 *    source actually changed as part of this update
 * Neither rule is specific to any one card -- both are plain properties of the schema.
 */
export function withDerivedValues(
  card: CardMetadata,
  previousValues: FieldValues,
  nextValues: FieldValues,
): FieldValues {
  const derived = { ...nextValues }

  for (const field of card.fields) {
    // A hidden mapped field keeps its walk: a player tracking several dungeons at
    // once (or peeking at another dungeon's shape) must not lose their position in
    // one by looking at another. Every other hidden field still resets -- Aetherflux
    // relies on that -- and compute() only ever reads the selected dungeon's path,
    // so a kept walk never leaks into the outputs.
    if (field.visible_if && !isFieldVisible(field, derived) && field.map === null) {
      derived[field.name] = field.default
    }
  }

  for (const field of card.fields) {
    const source = field.default_source
    if (source && derived[source] !== previousValues[source]) {
      derived[field.name] = derived[source]
    }
  }

  return derived
}

/** Guard against a named *output* (not the field's own value/bounds) -- e.g. "can't
 * afford this". Defaults to disabled, not permissive, while outputs aren't known yet. */
export function isActionGuardBlocked(field: FieldSpec, outputs: OutputValues | null): boolean {
  const guard = field.action_disabled_when
  if (!guard) return false
  if (!outputs) return true
  const guardedValue = outputs[guard.output]
  return typeof guardedValue !== 'number' || guardedValue < guard.less_than
}

export interface FieldGroups {
  setupFields: FieldSpec[]
  liveFields: FieldSpec[]
  /** True when every visible field is one-time setup, so the play area would
   * otherwise be empty: setup fields render inline there instead of only behind the
   * sheet, and the setup summary bar is suppressed (screen-spec.md rule 3). */
  renderSetupInline: boolean
}

export function splitFields(card: CardMetadata, values: FieldValues): FieldGroups {
  const visible = card.fields.filter((field) => isFieldVisible(field, values))
  const setupFields = visible.filter((field) => field.setup)
  const liveFields = visible.filter((field) => !field.setup)
  return {
    setupFields,
    liveFields,
    renderSetupInline: setupFields.length > 0 && liveFields.length === 0,
  }
}

export interface SetupSummaryItem {
  name: string
  text: string
}

/** A sequence field's value, defensively narrowed: anything that isn't a list of
 * strings (a stale persisted value, a hand-rolled API response) reads as empty
 * rather than throwing partway through a render. */
export function sequenceValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function summarizeField(field: FieldSpec, value: unknown): string {
  const shortLabel = field.short_label ?? field.label
  switch (field.kind) {
    case 'boolean':
      return `${shortLabel} ${value === true ? '✓' : '✗'}`
    case 'select': {
      const option = field.options?.find((candidate) => candidate.value === value)
      return option ? option.label : shortLabel
    }
    case 'sequence':
      // Entry count rather than the entries themselves: a summary chip is one line
      // on a phone, and a long roll log would blow straight past it.
      return `${sequenceValue(value).length} ${shortLabel}`
    case 'number':
    case 'counter':
      return `${String(value)} ${shortLabel}`
  }
}

/** One summary-bar chip per setup field (screen-spec.md rule 5). */
export function summarizeSetup(fields: FieldSpec[], values: FieldValues): SetupSummaryItem[] {
  return fields.map((field) => ({ name: field.name, text: summarizeField(field, values[field.name]) }))
}

/** The card's headline result: the output marked `primary`, or the first output when
 * none is marked. Every real card declares exactly one output, so this is safe. */
export function heroOutput(card: CardMetadata): OutputSpec {
  return card.outputs.find((output) => output.primary) ?? card.outputs[0]
}

/** Every output except the hero -- what StatStrip renders (screen-spec.md rule 6). */
export function nonPrimaryOutputs(card: CardMetadata): OutputSpec[] {
  const hero = heroOutput(card)
  return card.outputs.filter((output) => output.name !== hero.name)
}

/** When a card's alert output is true, its message; otherwise null. Centralizes the
 * `game_lost`-style special case so no component hardcodes an output name. */
export function resolveAlertMessage(card: CardMetadata, outputs: OutputValues | null): string | null {
  if (!card.alert || !outputs) return null
  return outputs[card.alert.output] === true ? card.alert.message : null
}

/** The active alert's tone, or null while no alert is active -- the same resolution
 * as the message, so banner styling and the one-shot sound agree on which moment
 * this is (a dungeon completed must not sound or read like a loss). */
export function resolveAlertTone(
  card: CardMetadata,
  outputs: OutputValues | null,
): 'danger' | 'success' | null {
  if (!card.alert || !outputs) return null
  return outputs[card.alert.output] === true ? card.alert.tone : null
}

const numberFormatter = new Intl.NumberFormat('en-US')

/**
 * A card's number, as it should appear on screen.
 *
 * Grouped digits normally. Past `Number.MAX_SAFE_INTEGER` it switches to exponential,
 * for two reasons that point the same way.
 *
 * The digits stop being real: Scute Swarm's declared bounds reach about 2^129, whose
 * exact value ends `...185614012416`, but the float renders as
 * `19,807,040,608,759,044,000,000,000,000,000,000,000`. Those trailing zeros are an
 * artefact of the representation, and printing them claims precision that does not
 * exist. `1.98e+37` is the honest answer.
 *
 * And it is 50 characters wide, on a screen about 420 wide. No font-size ladder saves
 * that.
 */
export function formatNumber(value: number): string {
  if (!Number.isSafeInteger(value)) return value.toExponential(2)
  return numberFormatter.format(value)
}

export type HeroFontSize = 'sm' | 'md' | 'lg'

/**
 * Steps the hero number's font size down as it gets wider, so a 6-digit Scute Swarm
 * total doesn't overflow the space a 2-digit Aetherflux total fits easily.
 *
 * Measures the **rendered** string, including its separators, because that is what has
 * to fit. Counting digits instead quietly did the wrong thing above 1e21, where
 * `String(value)` is exponential notation -- so it measured the length of
 * `"1.9807040608759044e+37"` (22) rather than the 38 digits actually there, and landed
 * on the right bucket by accident.
 */
export function heroFontSize(value: number): HeroFontSize {
  const width = formatNumber(value).length
  // Thresholds are the rendered widths of the old digit counts: "9,999" and "999,999".
  if (width <= 5) return 'lg'
  if (width <= 7) return 'md'
  return 'sm'
}
