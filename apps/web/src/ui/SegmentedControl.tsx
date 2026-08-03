import { Pressable } from './Pressable'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Group label for assistive tech -- the question the segments answer. */
  label: string
  disabled?: boolean
  /**
   * `flex-basis` for each segment. Defaults to a two-column wrap (the shape the Swiss
   * event-format selector this was extracted from used). Pass `'0'` for equal columns on
   * a single row. Inline rather than a Tailwind `basis-[...]` class so it can vary at
   * runtime without the JIT missing it.
   */
  itemBasis?: string
}

const base =
  'min-h-12 grow justify-center rounded-pill border text-body font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const selected = 'border-accent bg-accent text-accent-text'
const unselected = 'border-border bg-surface text-text'

/**
 * Three-plus-way single choice, rendered as a radiogroup of pill segments. The exact
 * pattern the Swiss screen hand-rolled twice; pulled into `src/ui/` so its ARIA wiring
 * and hit-target sizing live in one tested place (the `StatTile` precedent for extracting
 * at the third use). Keep `Toggle` for genuinely two-way boolean choices.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  itemBasis = 'calc(50% - 0.25rem)',
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            style={{ flexBasis: itemBasis }}
            className={`${base} ${isSelected ? selected : unselected}`}
          >
            {option.label}
          </Pressable>
        )
      })}
    </div>
  )
}
