import { useMemo, useState } from 'react'
import { sortByRecency } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { SearchIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'

interface CardPickerScreenProps {
  cards: CardMetadata[]
  onSelectCard: (cardId: string) => void
}

/** Search field over a list of cards, most-recently-opened first. Selecting a card
 * pushes CardScreen (App.tsx wires that + recordCardOpened together). */
export function CardPickerScreen({ cards, onSelectCard }: CardPickerScreenProps) {
  const [query, setQuery] = useState('')

  const visibleCards = useMemo(() => {
    const ordered = sortByRecency(cards)
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return ordered
    return ordered.filter((card) => card.name.toLowerCase().includes(normalizedQuery))
  }, [cards, query])

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4">
        <SearchIcon className="shrink-0 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cards"
          aria-label="Search cards"
          className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-text-muted"
        />
      </label>

      {visibleCards.length === 0 ? (
        <Text variant="body" color="muted">
          No cards match &quot;{query}&quot;.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleCards.map((card) => (
            <li key={card.id}>
              <Pressable
                onClick={() => onSelectCard(card.id)}
                className="min-h-12 w-full justify-between rounded-lg border border-border bg-surface px-4"
              >
                <Text variant="bodyStrong">{card.name}</Text>
              </Pressable>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
