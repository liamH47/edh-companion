import { useMemo, useState } from 'react'
import { sequenceValue } from '@mtg/core'
import type { FieldSpec, SelectOption } from '@mtg/core'
import { CloseIcon, PlusIcon, SearchIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'
import { CardThumb } from './CardThumb'

interface SourcePickerProps {
  field: FieldSpec
  value: unknown
  onChange: (name: string, value: unknown) => void
}

/** Entries collapsed to one row per option, in the order they were first added, with
 * the count that says "you control two of these". Mirrors how compute() reads the same
 * list, so the roster on screen and the effect lines below it can never disagree. */
function countedEntries(entries: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1)
  return [...counts].map(([value, count]) => ({ value, count }))
}

/**
 * A `sequence` field rendered as a searchable roster: the cards you control, plus a
 * search box to add more. The third way a sequence can look, beside the die (RollSpec)
 * and the dungeon map (MapSpec).
 *
 * The layout answers the problem the option-per-button layouts hit: a landfall roster
 * is drawn from dozens of cards, which is far past where a row of pills stays usable on
 * a phone. Search is the only affordance that keeps working as the list grows, and it
 * costs nothing when the list is short.
 *
 * Results only appear once something is typed. A permanently-open list of every option
 * would push the roster -- the part you actually read -- off the screen, and the roster
 * is what the player looks at during a turn.
 */
export function SourcePicker({ field, value, onChange }: SourcePickerProps) {
  const [query, setQuery] = useState('')
  const entries = sequenceValue(value)
  const options = useMemo(() => field.options ?? [], [field.options])
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  )

  const atCap = field.max !== null && entries.length >= field.max

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return [] as SelectOption[]
    return options.filter((option) => option.label.toLowerCase().includes(normalized))
  }, [options, query])

  // No cap guard here, and no not-found guard below: every caller of these is a control
  // this component only renders when the action is legal (adds vanish at the cap; a
  // remove button exists only for a row built from `entries`). A defensive branch would
  // be unreachable code the coverage gate could never justify.
  const add = (optionValue: string) => {
    onChange(field.name, [...entries, optionValue])
    setQuery('')
  }

  /** Removes one copy, not every copy: two Lotus Cobras become one, and the row stays. */
  const removeOne = (optionValue: string) => {
    const index = entries.lastIndexOf(optionValue)
    onChange(field.name, [...entries.slice(0, index), ...entries.slice(index + 1)])
  }

  const rows = countedEntries(entries)

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <Text variant="body" color="muted">
          {field.picker?.empty_label ?? 'Nothing added yet.'}
        </Text>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={field.label}>
          {rows.map(({ value: optionValue, count }) => {
            const option = optionByValue.get(optionValue)
            const label = option?.label ?? optionValue
            return (
              <li
                key={optionValue}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1"
              >
                <CardThumb scryfallId={option?.scryfall_id ?? null} width="w-8" />
                <Text variant="body" className="flex-1 text-left">
                  {label}
                  {count > 1 && (
                    <Text as="span" variant="label" color="muted">
                      {` x${count}`}
                    </Text>
                  )}
                </Text>
                {!atCap && (
                  <Pressable
                    aria-label={`Add another ${label}`}
                    onClick={() => add(optionValue)}
                    className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
                  >
                    <PlusIcon />
                  </Pressable>
                )}
                <Pressable
                  aria-label={`Remove ${label}`}
                  onClick={() => removeOne(optionValue)}
                  className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
                >
                  <CloseIcon />
                </Pressable>
              </li>
            )
          })}
        </ul>
      )}

      {atCap ? (
        <Text variant="body" color="muted">
          That&apos;s the maximum this tracker holds.
        </Text>
      ) : (
        <label className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4">
          <SearchIcon className="shrink-0 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={field.picker?.search_placeholder ?? 'Search'}
            aria-label={field.picker?.search_placeholder ?? 'Search'}
            className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-text-muted"
          />
        </label>
      )}

      {query.trim() !== '' && !atCap && (
        <ul className="flex flex-col gap-1">
          {matches.length === 0 ? (
            <li>
              <Text variant="body" color="muted">
                Nothing matches &quot;{query}&quot;.
              </Text>
            </li>
          ) : (
            matches.map((option) => (
              <li key={option.value}>
                <Pressable
                  aria-label={`Add ${option.label}`}
                  onClick={() => add(option.value)}
                  className="min-h-12 w-full gap-2 rounded-lg border border-border bg-surface-raised px-2 py-1"
                >
                  <CardThumb scryfallId={option.scryfall_id} width="w-8" />
                  <Text variant="body" className="flex-1 text-left">
                    {option.label}
                  </Text>
                  <PlusIcon className="shrink-0 text-text-muted" />
                </Pressable>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
