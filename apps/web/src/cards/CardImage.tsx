import { useState } from 'react'
import { cardImageUrl } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { Text } from '../ui/Text'

interface CardImageProps {
  card: CardMetadata
}

/**
 * The card as printed, fetched from Scryfall.
 *
 * This is the one thing in the app that needs a network. Everything else -- metadata,
 * compute, tournament state -- is bundled or local, so a card image must fail quietly:
 * the Oracle text rendered beneath it is the real content, and is always there. A
 * missing image should read as "no picture today", never as a broken screen.
 *
 * The `aspect` + `object-contain` pair is not styling for its own sake. Scryfall's terms
 * forbid distorting, skewing or stretching card images, so the box is fixed at the
 * printed 488x680 ratio and the image is contained inside it rather than filling it.
 * See cardImageUrl in @mtg/core for the rest of those rules.
 */
export function CardImage({ card }: CardImageProps) {
  const url = cardImageUrl(card)
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <Text as="p" variant="body" color="muted">
        Card image needs a connection. The text below works offline.
      </Text>
    )
  }

  return (
    <img
      src={url}
      alt={`${card.name}, as printed`}
      onError={() => setFailed(true)}
      loading="lazy"
      className="w-full self-center rounded-xl object-contain aspect-[488/680]"
    />
  )
}
