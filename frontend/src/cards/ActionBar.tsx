import { isActionGuardBlocked, sequenceValue } from '../core/cardModel'
import { tapHaptic } from '../core/haptics'
import type { FieldSpec, FieldValues, OutputValues } from '../types'
import { Button } from '../ui/Button'
import { DieRoller } from './DieRoller'

interface ActionBarProps {
  liveFields: FieldSpec[]
  values: FieldValues
  outputs: OutputValues | null
  onFieldChange: (name: string, value: unknown) => void
  onNewTurn: () => void
  /** Forwarded to DieRoller so a test can pin the face rolled. */
  rng?: () => number
}

/**
 * Bottom-pinned actions, in the thumb zone rather than buried in the scrolling field
 * list above (screen-spec.md). Three shapes feed it:
 *  - a live counter with an `action_label` gets one lg/fullWidth button ("Pay 50 Life")
 *  - a live `sequence` declaring `roll` gets a die the app rolls itself (Comet)
 *  - any other live `sequence` gets one button per declared option, each appending
 *    that option to the log
 * All honour the same `action_disabled_when` guard. "New turn" sits last, and the
 * bar is padded for the bottom safe area so it clears a phone's gesture bar.
 */
export function ActionBar({
  liveFields,
  values,
  outputs,
  onFieldChange,
  onNewTurn,
  rng,
}: ActionBarProps) {
  const counterActionFields = liveFields.filter(
    (field) => field.kind === 'counter' && field.action_label,
  )
  const sequenceFields = liveFields.filter((field) => field.kind === 'sequence')

  return (
    <div className="flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {counterActionFields.map((field) => {
        const count = typeof values[field.name] === 'number' ? (values[field.name] as number) : 0
        const atMax = field.max != null && count >= field.max
        const disabled = atMax || isActionGuardBlocked(field, outputs)
        return (
          <Button
            key={field.name}
            size="lg"
            fullWidth
            disabled={disabled}
            onClick={() => {
              tapHaptic()
              onFieldChange(field.name, count + 1)
            }}
          >
            {field.action_label}
          </Button>
        )
      })}

      {sequenceFields.map((field) => {
        const entries = sequenceValue(values[field.name])
        const atMax = field.max != null && entries.length >= field.max
        const disabled = atMax || isActionGuardBlocked(field, outputs)

        // A rolled sequence replaces the per-option buttons entirely: offering both a
        // die and six "pick your result" buttons would invite reporting a roll the app
        // didn't make.
        if (field.roll) {
          return (
            <DieRoller
              key={field.name}
              faces={field.roll.faces}
              actionLabel={field.roll.action_label}
              disabled={disabled}
              rng={rng}
              onRolled={(face) => onFieldChange(field.name, [...entries, String(face)])}
            />
          )
        }

        return (
          <div key={field.name} role="group" aria-label={field.label} className="flex flex-wrap gap-2">
            {(field.options ?? []).map((option) => (
              <Button
                key={option.value}
                size="lg"
                disabled={disabled}
                // Two per row (50% minus half the gap) rather than letting four
                // options wrap 3+1, which leaves a lone stretched button. `grow`
                // not `flex-1`, since flex-1 would reset the basis back to 0.
                className="grow basis-[calc(50%-0.25rem)]"
                onClick={() => {
                  tapHaptic()
                  onFieldChange(field.name, [...entries, option.value])
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )
      })}

      <Button variant="secondary" fullWidth onClick={onNewTurn}>
        New turn
      </Button>
    </div>
  )
}
