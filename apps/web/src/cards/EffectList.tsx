import type { EffectLine } from '@mtg/core'
import { Text } from '../ui/Text'

interface EffectListProps {
  label: string
  lines: EffectLine[]
  pending: boolean
  /** Shown in place of the list when nothing is on the roster yet. */
  emptyLabel: string
}

/**
 * The `list` hero: everything that happens at once, one row per source.
 *
 * The third hero shape, beside the plain number and the loyalty shield. It exists
 * because some cards' answer is not a number -- with three landfall permanents out, the
 * question "what happens when this land enters" has three answers and no total that
 * means anything.
 *
 * Each row reads left to right the way the player needs it during a turn: which
 * permanent, what it does once, and what that has come to this turn. The per-source
 * running total lives in the row rather than in another tile, so a roster of three
 * costs three lines instead of three lines plus a dozen mostly-zero tiles -- the
 * difference between fitting on a phone and not.
 *
 * `aria-live="polite"` on the list, matching HeroStat's contract: a land drop changes
 * every row at once, and a screen reader should hear the new state without hunting.
 */
export function EffectList({ label, lines, pending, emptyLabel }: EffectListProps) {
  return (
    <div className={`flex flex-col gap-1 ${pending ? 'opacity-60' : ''}`}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      {lines.length === 0 ? (
        <Text variant="body" color="muted">
          {emptyLabel}
        </Text>
      ) : (
        <ul className="flex flex-col gap-1" aria-live="polite" aria-label={label}>
          {lines.map((line) => (
            // Keyed by source: one row per permanent, and duplicates are already
            // collapsed into a single row with its count in the label.
            <li
              key={line.source}
              className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <Text variant="bodyStrong">{line.effect}</Text>
                <Text variant="label" className="text-accent">
                  {line.note}
                </Text>
              </div>
              <Text variant="label" color="muted">
                {line.source}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
