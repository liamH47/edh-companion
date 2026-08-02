import { sequenceValue } from '@mtg/core'
import type { FieldSpec } from '@mtg/core'
import { Chip } from '../ui/Chip'
import { UndoIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Stepper } from '../ui/Stepper'
import { Text } from '../ui/Text'
import { Toggle } from '../ui/Toggle'

interface FieldControlProps {
  field: FieldSpec
  value: unknown
  onChange: (name: string, value: unknown) => void
}

function assertNever(value: never): never {
  throw new Error(`Unhandled field kind from API: ${JSON.stringify(value)}`)
}

const selectOptionClasses =
  'min-h-12 rounded-pill border px-4 text-body font-semibold transition-colors'

/**
 * The FieldSpec.kind dispatch -- replaces Field.tsx, built from primitives instead
 * of raw <input>/<select> (portability-rules.md). `select` renders as a row of
 * radio-role Pressables instead of a native <select>, since RN has no <select>.
 *
 * A counter's `action_label` button (e.g. "Pay 50 Life") does NOT render here: it
 * moves to the bottom ActionBar so it sits in the thumb zone instead of the middle
 * of a scrolling field list (screen-spec.md's whole point). Absent that button, a
 * counter is visually identical to a number -- both are just a bounded Stepper.
 *
 * A `sequence` follows the same split for the same reason: the read-only log of what
 * you've entered so far lives here, while the buttons that append to it live in the
 * ActionBar where your thumb already is.
 */
export function FieldControl({ field, value, onChange }: FieldControlProps) {
  const helpText = field.help_text ? (
    <Text as="p" variant="body" color="muted">
      {field.help_text}
    </Text>
  ) : null

  switch (field.kind) {
    case 'boolean':
      return (
        <div className="flex flex-col gap-1">
          <Text variant="body">{field.label}</Text>
          <Toggle
            value={value === true}
            onChange={(next) => onChange(field.name, next)}
            label={field.label}
          />
          {helpText}
        </div>
      )
    case 'number':
    case 'counter':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text variant="body">{field.label}</Text>
            <Stepper
              value={typeof value === 'number' ? value : 0}
              onChange={(next) => onChange(field.name, next)}
              label={field.label}
              min={field.min ?? undefined}
              max={field.max ?? undefined}
            />
          </div>
          {helpText}
        </div>
      )
    case 'select': {
      const options = field.options ?? []
      return (
        <div className="flex flex-col gap-1">
          <Text variant="body">{field.label}</Text>
          <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-1">
            {options.map((option) => {
              const selected = value === option.value
              return (
                <Pressable
                  key={option.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(field.name, option.value)}
                  className={`${selectOptionClasses} ${
                    selected
                      ? 'border-accent bg-accent text-accent-text'
                      : 'border-border bg-surface text-text'
                  }`}
                >
                  {option.label}
                </Pressable>
              )
            })}
          </div>
          {helpText}
        </div>
      )
    }
    case 'sequence': {
      const entries = sequenceValue(value)
      const labelForValue = new Map((field.options ?? []).map((o) => [o.value, o.label]))
      return (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text variant="body">{field.label}</Text>
            {entries.length > 0 && (
              <Pressable
                aria-label={`Undo last ${field.label}`}
                onClick={() => onChange(field.name, entries.slice(0, -1))}
                className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
              >
                <UndoIcon />
              </Pressable>
            )}
          </div>
          {entries.length === 0 ? (
            <Text variant="body" color="muted">
              Nothing yet.
            </Text>
          ) : (
            <ol className="flex flex-wrap gap-1">
              {entries.map((entry, index) => (
                // Index-keyed deliberately: entries repeat (you can roll 6 twice) and
                // are only ever appended or popped, so position *is* the identity.
                <li key={index}>
                  <Chip>{labelForValue.get(entry) ?? entry}</Chip>
                </li>
              ))}
            </ol>
          )}
          {helpText}
        </div>
      )
    }
    default:
      return assertNever(field.kind)
  }
}
