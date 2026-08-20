import { describe, expect, it } from 'vitest'
import { InputError, validateInputs } from './validation'
import type { FieldSpec } from '../types'

/**
 * The parity corpus covers the error codes a *mechanical* sweep can reach -- bounds,
 * and options. It cannot reach wrong-type failures, because the generator only ever
 * produces well-typed values from a FieldSpec. Those paths are covered here.
 *
 * Codes, not messages: Python renders `True`/`'x'` where JavaScript renders
 * `true`/`"x"`, so the two languages keep their own wording and agree on the code.
 */
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
    new_turn_carries_output: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

function codeFor(fields: FieldSpec[], inputs: Record<string, unknown>): string {
  try {
    validateInputs(fields, inputs)
  } catch (error) {
    if (error instanceof InputError) return `${error.field}/${error.code}`
    throw error
  }
  return 'no error'
}

describe('validateInputs', () => {
  it('applies each field default for omitted keys', () => {
    const fields = [
      field({ name: 'count', kind: 'number', default: 7 }),
      field({ name: 'flag', kind: 'boolean', default: true }),
    ]
    expect(validateInputs(fields, {})).toEqual({ count: 7, flag: true })
  })

  it('prefers a supplied value over the default', () => {
    const fields = [field({ name: 'count', kind: 'number', default: 7 })]
    expect(validateInputs(fields, { count: 2 })).toEqual({ count: 2 })
  })

  it('accepts a declared select option', () => {
    // No card ships a select field today, so this path exists only for the next one
    // that does -- which is exactly why it needs a test rather than a corpus case.
    const fields = [
      field({
        name: 'mode',
        kind: 'select',
        default: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ]
    expect(validateInputs(fields, { mode: 'b' })).toEqual({ mode: 'b' })
  })

  it('validates counters the same way as numbers', () => {
    const fields = [field({ name: 'count', kind: 'counter', default: 0, max: 3 })]
    expect(validateInputs(fields, { count: 3 })).toEqual({ count: 3 })
    expect(codeFor(fields, { count: 4 })).toBe('count/above_max')
  })
})

describe('type failures the corpus cannot reach', () => {
  it('rejects a non-boolean for a boolean field', () => {
    expect(codeFor([field({ name: 'flag', kind: 'boolean' })], { flag: 'yes' })).toBe(
      'flag/not_boolean',
    )
  })

  it('rejects a non-integer for a number field', () => {
    const fields = [field({ name: 'count', kind: 'number', default: 0 })]
    expect(codeFor(fields, { count: 'three' })).toBe('count/not_integer')
    // A fraction is not an integer, and silently truncating one would be worse than
    // refusing it.
    expect(codeFor(fields, { count: 1.5 })).toBe('count/not_integer')
  })

  it('rejects a non-string for a select field', () => {
    const fields = [
      field({ name: 'mode', kind: 'select', options: [{ value: 'a', label: 'A' }] }),
    ]
    expect(codeFor(fields, { mode: 1 })).toBe('mode/not_string')
  })

  it('rejects a value outside a select field options', () => {
    const fields = [
      field({ name: 'mode', kind: 'select', options: [{ value: 'a', label: 'A' }] }),
    ]
    expect(codeFor(fields, { mode: 'b' })).toBe('mode/not_in_options')
  })

  it('rejects a non-array for a sequence field', () => {
    const fields = [
      field({ name: 'rolls', kind: 'sequence', options: [{ value: '1', label: '1' }] }),
    ]
    expect(codeFor(fields, { rolls: '1' })).toBe('rolls/not_list')
  })

  it('rejects a sequence entry outside the options', () => {
    const fields = [
      field({ name: 'rolls', kind: 'sequence', options: [{ value: '1', label: '1' }] }),
    ]
    expect(codeFor(fields, { rolls: ['1', '9'] })).toBe('rolls/entry_not_in_options')
    expect(codeFor(fields, { rolls: [1] })).toBe('rolls/entry_not_in_options')
  })

  it('rejects a sequence longer than the declared cap', () => {
    const fields = [
      field({ name: 'rolls', kind: 'sequence', max: 2, options: [{ value: '1', label: '1' }] }),
    ]
    expect(codeFor(fields, { rolls: ['1', '1', '1'] })).toBe('rolls/too_long')
  })

  it('rejects a value below the minimum', () => {
    expect(codeFor([field({ name: 'n', kind: 'number', min: 0 })], { n: -1 })).toBe('n/below_min')
  })
})

describe('a field declaring no options', () => {
  // Pydantic refuses to construct one of these on the backend, so it cannot arrive
  // through generated metadata. TypeScript has no such guarantee -- `options` is
  // nullable in the type -- so the nothing-is-allowed path is real here even though it
  // is unreachable there.
  it('allows nothing through a select', () => {
    expect(codeFor([field({ name: 'mode', kind: 'select' })], { mode: 'a' })).toBe(
      'mode/not_in_options',
    )
  })

  it('allows nothing through a sequence', () => {
    expect(codeFor([field({ name: 'rolls', kind: 'sequence' })], { rolls: ['a'] })).toBe(
      'rolls/entry_not_in_options',
    )
  })

  it('still accepts an empty sequence', () => {
    expect(validateInputs([field({ name: 'rolls', kind: 'sequence' })], { rolls: [] })).toEqual({
      rolls: [],
    })
  })
})

describe('sequence copying', () => {
  it('returns a copy, so a card session cannot mutate the shared default', () => {
    // A sequence field's default is one array on the metadata singleton. Handing it
    // back would let one session's inputs alias every later default.
    const shared: string[] = []
    const fields = [
      field({
        name: 'rolls',
        kind: 'sequence',
        default: shared,
        options: [{ value: '1', label: '1' }],
      }),
    ]
    const validated = validateInputs(fields, {}) as { rolls: string[] }
    validated.rolls.push('1')

    expect(shared).toEqual([])
  })
})
