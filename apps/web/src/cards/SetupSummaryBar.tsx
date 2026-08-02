import { summarizeSetup } from '@mtg/core'
import type { FieldSpec, FieldValues } from '@mtg/core'
import { Chip } from '../ui/Chip'
import { PencilIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

interface SetupSummaryBarProps {
  fields: FieldSpec[]
  values: FieldValues
  onPress: () => void
}

/**
 * One-line, horizontally-scrolling (never wrapping) summary of confirmed setup
 * values, plus a trailing edit affordance (screen-spec.md rule 5). The whole bar is
 * one tap target -- individual chips aren't independently tappable. Renders nothing
 * when there are no setup fields (rule 2).
 */
export function SetupSummaryBar({ fields, values, onPress }: SetupSummaryBarProps) {
  if (fields.length === 0) return null

  const items = summarizeSetup(fields, values)

  return (
    <Pressable
      onClick={onPress}
      aria-label="Edit board state"
      className="min-h-12 w-full justify-between gap-3 rounded-lg border border-border bg-surface px-3"
    >
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {items.map((item) => (
          <Chip key={item.name} className="shrink-0">
            {item.text}
          </Chip>
        ))}
      </div>
      <PencilIcon className="shrink-0 text-text-muted" />
    </Pressable>
  )
}
