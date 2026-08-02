import { isActionGuardBlocked, sequenceValue } from '../core/cardModel'
import { tapHaptic } from '../core/haptics'
import type { FieldSpec, FieldValues, OutputValues } from '../types'
import { Button } from '../ui/Button'

interface ActionBarProps {
  liveFields: FieldSpec[]
  values: FieldValues
  outputs: OutputValues | null
  onFieldChange: (name: string, value: unknown) => void
  onNewTurn: () => void
}

/**
 * Bottom-pinned actions, in the thumb zone rather than buried in the scrolling field
 * list above (screen-spec.md). Two shapes feed it:
 *  - a live counter with an `action_label` gets one lg/fullWidth button ("Pay 50 Life")
 *  - a live `sequence` gets one button per declared option, wrapped in a row, each
 *    appending that option to the log ("1-2" / "3" / "4-5" / "6" for Comet)
 * Both honour the same `action_disabled_when` guard. "New turn" sits last, and the
 * bar is padded for the bottom safe area so it clears a phone's gesture bar.
 */
export function ActionBar({
  liveFields,
  values,
  outputs,
  onFieldChange,
  onNewTurn,
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
