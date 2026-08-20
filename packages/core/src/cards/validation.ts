import type { FieldSpec, FieldValues, MapSpec } from '../types'

/**
 * The TypeScript half of card input validation. Mirrors `backend/app/cards/validation.py`
 * field-for-field; the parity corpus asserts they agree.
 *
 * Errors carry a `code` rather than only a message. Python's messages embed `repr()`,
 * which renders `True`/`'x'` where JavaScript renders `true`/`"x"` -- so asserting
 * message equality across the two would mean maintaining a Python `repr` in TypeScript
 * forever, and would break on values nobody anticipated. The code is a small closed set
 * both sides agree on; the message is each language's own.
 */
export type InputErrorCode =
  | 'not_boolean'
  | 'not_integer'
  | 'below_min'
  | 'above_max'
  | 'not_string'
  | 'not_in_options'
  | 'not_list'
  | 'too_long'
  | 'entry_not_in_options'
  | 'illegal_room'

export class InputError extends Error {
  // Declared explicitly rather than as constructor parameter properties, which are a
  // TypeScript-only construct and so barred by `erasableSyntaxOnly`.
  readonly field: string
  readonly code: InputErrorCode

  constructor(field: string, code: InputErrorCode, message: string) {
    super(message)
    this.name = 'InputError'
    this.field = field
    this.code = code
  }
}

function allowedValues(field: FieldSpec): string[] {
  return (field.options ?? []).map((option) => option.value)
}

function validateBoolean(field: FieldSpec, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new InputError(field.name, 'not_boolean', `${field.name} must be a boolean`)
  }
  return value
}

function validateNumber(field: FieldSpec, value: unknown): number {
  // Python additionally rejects `True`, since bool subclasses int there. No such
  // hazard here -- a boolean is not a number in JavaScript -- which is exactly why
  // the corpus compares codes rather than trying to mirror the check itself.
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InputError(field.name, 'not_integer', `${field.name} must be an integer`)
  }
  if (field.min != null && value < field.min) {
    throw new InputError(field.name, 'below_min', `${field.name} must be >= ${field.min}`)
  }
  if (field.max != null && value > field.max) {
    throw new InputError(field.name, 'above_max', `${field.name} must be <= ${field.max}`)
  }
  return value
}

function validateSelect(field: FieldSpec, value: unknown): string {
  if (typeof value !== 'string') {
    throw new InputError(field.name, 'not_string', `${field.name} must be a string`)
  }
  const allowed = allowedValues(field)
  if (!allowed.includes(value)) {
    throw new InputError(
      field.name,
      'not_in_options',
      `${field.name} must be one of ${[...allowed].sort().join(', ')}`,
    )
  }
  return value
}

function validateSequence(field: FieldSpec, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new InputError(field.name, 'not_list', `${field.name} must be a list`)
  }
  if (field.max != null && value.length > field.max) {
    throw new InputError(
      field.name,
      'too_long',
      `${field.name} must have at most ${field.max} entries`,
    )
  }
  const allowed = allowedValues(field)
  for (const entry of value) {
    if (typeof entry !== 'string' || !allowed.includes(entry)) {
      throw new InputError(
        field.name,
        'entry_not_in_options',
        `${field.name} entries must each be one of ${[...allowed].sort().join(', ')}`,
      )
    }
  }
  if (field.map != null) {
    validateWalk(field, field.map, value as string[])
  }
  // A copy, for the same reason Python returns one: a sequence field's default is a
  // shared array on the metadata singleton, so handing it back would let one session's
  // inputs alias every later default.
  return [...value]
}

/** A mapped sequence must be a legal walk: start at the entry, then follow an edge for
 * every step. Venture never moves backwards or teleports (CR 309); the UI only offers
 * legal successors, so this rejects only a hand-crafted input -- the same defensive
 * posture the membership check above already takes. */
function validateWalk(field: FieldSpec, map: MapSpec, value: string[]): void {
  if (value.length === 0) return
  if (value[0] !== map.entry) {
    throw new InputError(
      field.name,
      'illegal_room',
      `${field.name} must start at ${map.entry}`,
    )
  }
  const successors = new Map<string, Set<string>>()
  for (const edge of map.edges) {
    let targets = successors.get(edge.source)
    if (!targets) {
      targets = new Set()
      successors.set(edge.source, targets)
    }
    targets.add(edge.target)
  }
  for (let i = 1; i < value.length; i += 1) {
    if (!successors.get(value[i - 1])?.has(value[i])) {
      throw new InputError(
        field.name,
        'illegal_room',
        `${field.name} cannot move from ${value[i - 1]} to ${value[i]}`,
      )
    }
  }
}

/** Applies each field's default for omitted keys, then type/bounds-checks every value. */
export function validateInputs(fields: FieldSpec[], rawInputs: FieldValues): FieldValues {
  const validated: FieldValues = {}
  for (const field of fields) {
    const value = field.name in rawInputs ? rawInputs[field.name] : field.default
    switch (field.kind) {
      case 'boolean':
        validated[field.name] = validateBoolean(field, value)
        break
      case 'number':
      case 'counter':
        validated[field.name] = validateNumber(field, value)
        break
      case 'select':
        validated[field.name] = validateSelect(field, value)
        break
      case 'sequence':
        validated[field.name] = validateSequence(field, value)
        break
    }
  }
  return validated
}
