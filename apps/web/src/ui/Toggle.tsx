import { Pressable } from './Pressable'

interface ToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  label: string
  trueLabel?: string
  falseLabel?: string
}

const segmentBase =
  'min-h-12 flex-1 justify-center rounded-pill px-4 text-body font-semibold'
const selectedClasses = 'bg-accent text-accent-text'
const unselectedClasses = 'bg-transparent text-text-muted'

/**
 * Two-way segmented control for boolean fields -- replaces a checkbox with a
 * pattern React Native has a direct equivalent for. Renders `true` on the left.
 */
export function Toggle({ value, onChange, label, trueLabel = 'Yes', falseLabel = 'No' }: ToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-1 rounded-pill border border-border bg-surface p-1"
    >
      <Pressable
        aria-pressed={value}
        onClick={() => onChange(true)}
        className={`${segmentBase} ${value ? selectedClasses : unselectedClasses}`}
      >
        {trueLabel}
      </Pressable>
      <Pressable
        aria-pressed={!value}
        onClick={() => onChange(false)}
        className={`${segmentBase} ${!value ? selectedClasses : unselectedClasses}`}
      >
        {falseLabel}
      </Pressable>
    </div>
  )
}
