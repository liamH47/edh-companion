import type { ChangeEvent } from 'react'
import { tapHaptic } from '../core/haptics'
import { Pressable } from './Pressable'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  label: string
  min?: number
  max?: number
  step?: number
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let clamped = value
  if (min != null) clamped = Math.max(min, clamped)
  if (max != null) clamped = Math.min(max, clamped)
  return clamped
}

const buttonClasses =
  'min-h-12 min-w-12 shrink-0 justify-center rounded-full border border-border bg-surface text-title font-semibold text-text disabled:text-disabled-text disabled:bg-disabled-surface'

const inputClasses =
  'min-h-12 w-20 shrink-0 rounded-lg border border-border bg-surface text-center text-stat-tile font-bold text-text tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted'

/**
 * A - value + row for a bounded numeric input: two step buttons around a real,
 * directly-editable number field. Values like starting_life range 0-99999 --
 * reaching those by tapping alone isn't usable, so this is not tap-only. Every
 * field kind that isn't boolean/select renders through this (setup numbers and
 * live counters alike).
 */
export function Stepper({ value, onChange, label, min, max, step = 1 }: StepperProps) {
  const atMin = min != null && value <= min
  const atMax = max != null && value >= max

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    // A type="number" input's value is always '' or a valid numeric string (browsers
    // reject anything else at the DOM level), so Number(raw) here is never NaN.
    const raw = event.target.value
    if (raw === '') return
    onChange(clamp(Math.trunc(Number(raw)), min, max))
  }

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <Pressable
        aria-label={`Decrease ${label}`}
        disabled={atMin}
        onClick={() => {
          tapHaptic()
          onChange(clamp(value - step, min, max))
        }}
        className={buttonClasses}
      >
        −
      </Pressable>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={handleInputChange}
        className={inputClasses}
      />
      <Pressable
        aria-label={`Increase ${label}`}
        disabled={atMax}
        onClick={() => {
          tapHaptic()
          onChange(clamp(value + step, min, max))
        }}
        className={buttonClasses}
      >
        +
      </Pressable>
    </div>
  )
}
