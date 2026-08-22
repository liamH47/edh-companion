import { sequenceValue } from '@mtg/core'
import type { FieldSpec } from '@mtg/core'
import type { ManaColor } from '@mtg/core/theme/tokens'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'
import { ManaSymbol } from './ManaSymbol'

interface ManaPoolProps {
  field: FieldSpec
  value: unknown
  onChange: (name: string, value: unknown) => void
}

/**
 * A mana pool: one column per color, tap the disc to add, minus to spend.
 *
 * The fourth rendering of a `sequence` field, after the die, the dungeon map and the
 * searchable roster. The value is a plain list of color letters -- `["G","G","U"]` is
 * two green and one blue -- so compute() reads it exactly as it reads a landfall roster
 * and never learns there is a pool involved.
 *
 * A column each rather than a row of discs with a shared stepper: "add green" and
 * "spend green" are different actions on different colors, and a shared control would
 * need a selected color to act on, which is a mode. Six columns of 44px fit a 360px
 * phone with room to spare.
 *
 * The colors themselves do the labelling -- a Magic player reads WUBRG by hue faster
 * than by word -- but every control still carries a spelled-out accessible name, since
 * hue is exactly what a screen reader cannot convey.
 */
const COLOR_NAMES: Record<string, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colorless',
}

export function ManaPool({ field, value, onChange }: ManaPoolProps) {
  const entries = sequenceValue(value)
  const colors = (field.options ?? []).map((option) => option.value)

  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1)

  const atCap = field.max !== null && entries.length >= field.max

  const add = (color: string) => onChange(field.name, [...entries, color])

  /** Spends one of that color, keeping the rest. Order in the list is meaningless, so
   * the last one added is as good as any. */
  const spend = (color: string) => {
    const index = entries.lastIndexOf(color)
    onChange(field.name, [...entries.slice(0, index), ...entries.slice(index + 1)])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-center gap-1">
        {colors.map((color) => {
          const count = counts.get(color) ?? 0
          const name = COLOR_NAMES[color] ?? color
          return (
            <div key={color} className="flex flex-col items-center gap-0.5">
              <Pressable
                aria-label={`Add ${name} mana`}
                onClick={() => add(color)}
                disabled={atCap}
                className="min-h-12 min-w-12 justify-center rounded-full"
              >
                <ManaSymbol color={color as ManaColor} dimmed={count === 0} />
              </Pressable>
              <Text
                as="div"
                variant="statTile"
                className={count > 0 ? 'text-text' : 'text-text-muted'}
                aria-live="polite"
              >
                <span className="sr-only">{`${name}: `}</span>
                {count}
              </Text>
              <Pressable
                aria-label={`Spend ${name} mana`}
                onClick={() => spend(color)}
                disabled={count === 0}
                className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                </svg>
              </Pressable>
            </div>
          )
        })}
      </div>

      {entries.length > 0 && (
        <Pressable
          aria-label="Empty the pool"
          onClick={() => onChange(field.name, [])}
          className="min-h-12 justify-center rounded-pill border border-border text-body font-semibold text-text-muted hover:text-text"
        >
          Empty pool
        </Pressable>
      )}

      {atCap && (
        <Text variant="body" color="muted">
          That&apos;s as much as this pool holds.
        </Text>
      )}
    </div>
  )
}
