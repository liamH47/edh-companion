import { useState } from 'react'
import { cardImageUrl } from '@mtg/core'
import { CardsIcon } from '../ui/Icon'

interface CardThumbProps {
  /** The printed card, or null for an entry no single card represents. */
  scryfallId: string | null
  /** Tailwind width class. The 488x680 aspect is fixed either way -- Scryfall's terms
   * forbid distorting a card image, so only the width is ever a caller's choice. */
  width?: string
}

/**
 * A small full-card thumbnail, and the card-back tile it degrades to.
 *
 * Scryfall's `small` version is the **full** printed card, not an art crop, so the
 * artist and copyright line stay in frame -- the same compliance-by-construction
 * `CardImage` relies on (the rules live beside `cardImageUrl` in @mtg/core).
 *
 * Always decorative: every caller renders the card's name right beside it, so a second
 * reading of the same name is noise to a screen reader. Cardless entries and dead
 * connections both land on the tile, which is why the list keeps its shape offline
 * instead of collapsing to bare text.
 */
export function CardThumb({ scryfallId, width = 'w-10' }: CardThumbProps) {
  const url = cardImageUrl({ scryfall_id: scryfallId }, 'small')
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div
        aria-hidden="true"
        data-testid="card-thumb-fallback"
        className={`flex aspect-[488/680] ${width} shrink-0 items-center justify-center rounded-sm border border-border bg-surface-raised text-text-muted`}
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
      className={`aspect-[488/680] ${width} shrink-0 rounded-sm object-contain`}
    />
  )
}
