import { useMemo, useState } from 'react'
import { cardImageUrl, sortByRecency } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { CardsIcon, SearchIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'

/**
 * Small full-card thumbnail for a picker row. Scryfall's `small` version (146x204) is
 * the **full** printed card, so the artist and copyright line stay in frame -- the same
 * by-construction compliance CardImage relies on (see cardImageUrl). Decorative: the
 * card's name sits right beside it, so the image is hidden from the accessibility tree.
 * Cardless entries (commander tax, dungeons) and a failed load fall back to the same
 * quiet card-back tile, so offline the list just loses its pictures, not its shape.
 */
function CardThumb({ card }: { card: CardMetadata }) {
  const url = cardImageUrl(card, 'small')
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div
        aria-hidden="true"
        data-testid="card-thumb-fallback"
        className="flex aspect-[488/680] w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-raised text-text-muted"
      >
        <CardsIcon size={16} />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[488/680] w-10 shrink-0 rounded-sm object-contain"
    />
  )
}

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
                className="min-h-12 w-full gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <CardThumb card={card} />
                <Text variant="bodyStrong" className="flex-1 text-left">
                  {card.name}
                </Text>
              </Pressable>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
