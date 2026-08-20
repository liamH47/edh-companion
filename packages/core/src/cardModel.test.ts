import { describe, expect, it } from 'vitest'
import type { CardMetadata, FieldSpec, OutputSpec } from './types'
import {
  defaultValues,
  formatNumber,
  heroFontSize,
  heroOutput,
  isActionGuardBlocked,
  isFieldVisible,
  nonPrimaryOutputs,
  resolveAlertMessage,
  sequenceValue,
  splitFields,
  summarizeSetup,
  withDerivedValues,
} from './cardModel'

function field(overrides: Partial<FieldSpec> & Pick<FieldSpec, 'name' | 'kind'>): FieldSpec {
  return {
    label: overrides.name,
    default: null,
    min: null,
    max: null,
    options: null,
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    map: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

function output(overrides: Partial<OutputSpec> & Pick<OutputSpec, 'name'>): OutputSpec {
  return {
    label: overrides.name,
    kind: 'number',
    short_label: null,
    primary: false,
    hero_shape: 'number',
    ...overrides,
  }
}

function card(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'test-card',
    name: 'Test Card',
    rules_text: '...',
    scryfall_id: null,
    show_hero_art: false,
    resets_on_new_turn: true,
    fields: [],
    outputs: [],
    alert: null,
    ...overrides,
  }
}

describe('defaultValues', () => {
  it('maps every field to its declared default', () => {
    const c = card({
      fields: [
        field({ name: 'a', kind: 'number', default: 5 }),
        field({ name: 'b', kind: 'boolean', default: true }),
      ],
    })
    expect(defaultValues(c)).toEqual({ a: 5, b: true })
  })

  it('returns an empty object for a card with no fields', () => {
    expect(defaultValues(card())).toEqual({})
  })
})

describe('isFieldVisible', () => {
  it('is visible when there is no visible_if', () => {
    expect(isFieldVisible(field({ name: 'a', kind: 'number' }), {})).toBe(true)
  })

  it('is visible when the referenced field equals the expected value', () => {
    const f = field({ name: 'a', kind: 'number', visible_if: { field: 'gate', equals: true } })
    expect(isFieldVisible(f, { gate: true })).toBe(true)
  })

  it('is hidden when the referenced field does not equal the expected value', () => {
    const f = field({ name: 'a', kind: 'number', visible_if: { field: 'gate', equals: true } })
    expect(isFieldVisible(f, { gate: false })).toBe(false)
  })
})

describe('withDerivedValues', () => {
  it('resets a field to its default once it becomes hidden', () => {
    const c = card({
      fields: [
        field({ name: 'gate', kind: 'boolean', default: true }),
        field({
          name: 'dependent',
          kind: 'number',
          default: 0,
          visible_if: { field: 'gate', equals: false },
        }),
      ],
    })
    const previous = { gate: false, dependent: 7 }
    const next = withDerivedValues(c, previous, { gate: true, dependent: 7 })
    expect(next.dependent).toBe(0)
  })

  it('keeps a visible field untouched', () => {
    const c = card({
      fields: [
        field({ name: 'gate', kind: 'boolean', default: true }),
        field({
          name: 'dependent',
          kind: 'number',
          default: 0,
          visible_if: { field: 'gate', equals: true },
        }),
      ],
    })
    const previous = { gate: true, dependent: 7 }
    const next = withDerivedValues(c, previous, { gate: true, dependent: 7 })
    expect(next.dependent).toBe(7)
  })

  it('re-syncs a default_source field when its source changes', () => {
    const c = card({
      fields: [
        field({ name: 'baseline', kind: 'number', default: 0 }),
        field({ name: 'running', kind: 'counter', default: 0, default_source: 'baseline' }),
      ],
    })
    const previous = { baseline: 2, running: 2 }
    const next = withDerivedValues(c, previous, { baseline: 5, running: 2 })
    expect(next.running).toBe(5)
  })

  it('does not resync a default_source field when the source is unchanged', () => {
    const c = card({
      fields: [
        field({ name: 'baseline', kind: 'number', default: 0 }),
        field({ name: 'running', kind: 'counter', default: 0, default_source: 'baseline' }),
      ],
    })
    const previous = { baseline: 2, running: 9 }
    const next = withDerivedValues(c, previous, { baseline: 2, running: 9 })
    expect(next.running).toBe(9)
  })
})

describe('isActionGuardBlocked', () => {
  it('is not blocked when the field has no guard', () => {
    expect(isActionGuardBlocked(field({ name: 'a', kind: 'counter' }), { x: 100 })).toBe(false)
  })

  it('is blocked when outputs are not yet known', () => {
    const f = field({
      name: 'a',
      kind: 'counter',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    })
    expect(isActionGuardBlocked(f, null)).toBe(true)
  })

  it('is blocked when the guarded output is below the threshold', () => {
    const f = field({
      name: 'a',
      kind: 'counter',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    })
    expect(isActionGuardBlocked(f, { current_life: 20 })).toBe(true)
  })

  it('is not blocked when the guarded output meets the threshold', () => {
    const f = field({
      name: 'a',
      kind: 'counter',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    })
    expect(isActionGuardBlocked(f, { current_life: 50 })).toBe(false)
  })

  it('is blocked when the guarded output is not a number', () => {
    const f = field({
      name: 'a',
      kind: 'counter',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    })
    expect(isActionGuardBlocked(f, { current_life: 'unknown' })).toBe(true)
  })
})

describe('splitFields', () => {
  it('splits visible fields into setup and live groups', () => {
    const c = card({
      fields: [
        field({ name: 'a', kind: 'number', setup: true }),
        field({ name: 'b', kind: 'counter', setup: false }),
      ],
    })
    const groups = splitFields(c, defaultValues(c))
    expect(groups.setupFields.map((f) => f.name)).toEqual(['a'])
    expect(groups.liveFields.map((f) => f.name)).toEqual(['b'])
    expect(groups.renderSetupInline).toBe(false)
  })

  it('excludes hidden fields from both groups', () => {
    const c = card({
      fields: [
        field({ name: 'gate', kind: 'boolean', default: false, setup: true }),
        field({
          name: 'dependent',
          kind: 'number',
          setup: true,
          visible_if: { field: 'gate', equals: true },
        }),
      ],
    })
    const groups = splitFields(c, { gate: false })
    expect(groups.setupFields.map((f) => f.name)).toEqual(['gate'])
  })

  it('flags renderSetupInline when every visible field is setup', () => {
    const c = card({ fields: [field({ name: 'a', kind: 'number', setup: true })] })
    const groups = splitFields(c, defaultValues(c))
    expect(groups.renderSetupInline).toBe(true)
  })

  it('does not flag renderSetupInline when there are no setup fields', () => {
    const c = card({ fields: [field({ name: 'a', kind: 'counter', setup: false })] })
    const groups = splitFields(c, defaultValues(c))
    expect(groups.renderSetupInline).toBe(false)
    expect(groups.setupFields).toEqual([])
  })

  it('does not flag renderSetupInline for a card with no fields at all', () => {
    const groups = splitFields(card(), {})
    expect(groups.renderSetupInline).toBe(false)
  })
})

describe('summarizeSetup', () => {
  it('formats a boolean field as short_label plus a check or cross', () => {
    const f = field({ name: 'in_play', kind: 'boolean', short_label: 'in play' })
    expect(summarizeSetup([f], { in_play: true })).toEqual([{ name: 'in_play', text: 'in play ✓' }])
    expect(summarizeSetup([f], { in_play: false })).toEqual([{ name: 'in_play', text: 'in play ✗' }])
  })

  it('formats a number field as value plus short_label', () => {
    const f = field({ name: 'starting_life', kind: 'number', short_label: 'start life' })
    expect(summarizeSetup([f], { starting_life: 40 })).toEqual([
      { name: 'starting_life', text: '40 start life' },
    ])
  })

  it('formats a counter field the same as number', () => {
    const f = field({ name: 'activations', kind: 'counter', short_label: 'activations' })
    expect(summarizeSetup([f], { activations: 2 })).toEqual([
      { name: 'activations', text: '2 activations' },
    ])
  })

  it('formats a select field as the matching option label', () => {
    const f = field({
      name: 'mode',
      kind: 'select',
      options: [
        { value: 'a', label: 'Mode A' },
        { value: 'b', label: 'Mode B' },
      ],
    })
    expect(summarizeSetup([f], { mode: 'b' })).toEqual([{ name: 'mode', text: 'Mode B' }])
  })

  it('falls back to the field label for a select value with no matching option', () => {
    const f = field({ name: 'mode', kind: 'select', label: 'Mode', options: [{ value: 'a', label: 'A' }] })
    expect(summarizeSetup([f], { mode: 'missing' })).toEqual([{ name: 'mode', text: 'Mode' }])
  })

  it('falls back to label when short_label is null', () => {
    const f = field({ name: 'starting_life', kind: 'number', label: 'Starting life' })
    expect(summarizeSetup([f], { starting_life: 40 })).toEqual([
      { name: 'starting_life', text: '40 Starting life' },
    ])
  })

  it('summarizes a sequence field by entry count, not by its entries', () => {
    const f = field({
      name: 'rolls',
      kind: 'sequence',
      short_label: 'rolls',
      options: [
        { value: '1-2', label: '1–2' },
        { value: '6', label: '6' },
      ],
    })
    expect(summarizeSetup([f], { rolls: ['1-2', '6', '6'] })).toEqual([
      { name: 'rolls', text: '3 rolls' },
    ])
  })
})

describe('sequenceValue', () => {
  it('returns a list of strings unchanged', () => {
    expect(sequenceValue(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('returns an empty array for a non-array value', () => {
    expect(sequenceValue(undefined)).toEqual([])
    expect(sequenceValue(null)).toEqual([])
    expect(sequenceValue('a')).toEqual([])
  })

  it('drops non-string entries rather than throwing mid-render', () => {
    expect(sequenceValue(['a', 3, null, 'b'])).toEqual(['a', 'b'])
  })
})

describe('heroOutput / nonPrimaryOutputs', () => {
  it('picks the output marked primary', () => {
    const c = card({
      outputs: [output({ name: 'a' }), output({ name: 'b', primary: true }), output({ name: 'c' })],
    })
    expect(heroOutput(c).name).toBe('b')
    expect(nonPrimaryOutputs(c).map((o) => o.name)).toEqual(['a', 'c'])
  })

  it('falls back to the first output when none is marked primary', () => {
    const c = card({ outputs: [output({ name: 'a' }), output({ name: 'b' })] })
    expect(heroOutput(c).name).toBe('a')
    expect(nonPrimaryOutputs(c).map((o) => o.name)).toEqual(['b'])
  })

  it('returns an empty array of non-primary outputs for a single-output card', () => {
    const c = card({ outputs: [output({ name: 'only' })] })
    expect(nonPrimaryOutputs(c)).toEqual([])
  })
})

describe('resolveAlertMessage', () => {
  it('returns null when the card has no alert spec', () => {
    const c = card({ alert: null })
    expect(resolveAlertMessage(c, { game_lost: true })).toBeNull()
  })

  it('returns null when outputs are not yet known', () => {
    const c = card({ alert: { output: 'game_lost', message: 'You lose' } })
    expect(resolveAlertMessage(c, null)).toBeNull()
  })

  it('returns null when the alert output is false', () => {
    const c = card({ alert: { output: 'game_lost', message: 'You lose' } })
    expect(resolveAlertMessage(c, { game_lost: false })).toBeNull()
  })

  it('returns the message when the alert output is true', () => {
    const c = card({ alert: { output: 'game_lost', message: 'You lose' } })
    expect(resolveAlertMessage(c, { game_lost: true })).toBe('You lose')
  })
})

describe('formatNumber', () => {
  it('adds grouping separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-60)).toBe('-60')
  })

  it('formats small numbers without separators', () => {
    expect(formatNumber(7)).toBe('7')
  })
})

describe('heroFontSize', () => {
  it('returns lg for 1-4 digit values', () => {
    expect(heroFontSize(0)).toBe('lg')
    expect(heroFontSize(50)).toBe('lg')
    expect(heroFontSize(9999)).toBe('lg')
  })

  it('returns md for 5-6 digit values', () => {
    expect(heroFontSize(10000)).toBe('md')
    expect(heroFontSize(999999)).toBe('md')
  })

  it('returns sm for 7+ digit values', () => {
    expect(heroFontSize(1000000)).toBe('sm')
  })

  it('sizes by magnitude, ignoring sign', () => {
    expect(heroFontSize(-60)).toBe('lg')
    expect(heroFontSize(-1000000)).toBe('sm')
  })
})

const numberFormatter = new Intl.NumberFormat('en-US')

describe('numbers too large to be exact', () => {
  // Scute Swarm's declared bounds reach about 2^129. These are unreachable in a real
  // game, but the bounds promise them, so the display has to survive them.
  const SCUTE_MAX = 19807040608759043769819903185614012416

  it('renders an unsafe integer in exponential form', () => {
    // Past 2^53 the trailing digits are an artefact of the float, not the answer --
    // printing them would claim precision that does not exist.
    expect(formatNumber(SCUTE_MAX)).toBe('1.98e+37')
  })

  it('keeps the rendered width readable at any magnitude', () => {
    // The grouped form is 50 characters, on a screen about 420 wide.
    expect(numberFormatter.format(SCUTE_MAX).length).toBeGreaterThan(40)
    expect(formatNumber(SCUTE_MAX).length).toBeLessThan(12)
  })

  it('still groups every value that is exact', () => {
    expect(formatNumber(Number.MAX_SAFE_INTEGER)).toBe('9,007,199,254,740,991')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('handles a negative unsafe integer', () => {
    expect(formatNumber(-SCUTE_MAX)).toBe('-1.98e+37')
  })
})

describe('heroFontSize measures the rendered string', () => {
  it('steps down as the number gets wider', () => {
    expect(heroFontSize(0)).toBe('lg')
    expect(heroFontSize(9999)).toBe('lg')
    expect(heroFontSize(10000)).toBe('md') // "10,000" -- 6 characters
    expect(heroFontSize(999999)).toBe('md')
    expect(heroFontSize(1000000)).toBe('sm') // "1,000,000" -- 9 characters
  })

  it('accounts for a minus sign, which takes real width', () => {
    // Nykthos deliberately reports a negative net, so this is a live case.
    expect(heroFontSize(-9999)).toBe('md')
  })

  it('shrinks for an unsafe integer rather than measuring exponential notation', () => {
    // The old implementation counted the characters of "1.98...e+37" (22) instead of
    // the 38 digits, and reached the right bucket by luck.
    expect(heroFontSize(19807040608759043769819903185614012416)).toBe('sm')
  })
})
