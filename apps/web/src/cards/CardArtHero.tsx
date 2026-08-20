import { useState } from 'react'
import { cardImageUrl } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { LoyaltyShield, LoyaltyBadge } from './LoyaltyShield'

interface CardArtHeroProps {
  card: CardMetadata
  label: string
  value: number
  pending: boolean
  dead: boolean
}

/**
 * The card itself as the hero: the printed image, large, with the live loyalty drawn
 * in a badge over the printed loyalty box -- the number on the card is the number in
 * the game. A deliberate, recorded exception to the no-overlay reading of Scryfall's
 * terms (see the decision note in cardImage.ts): the badge covers only the printed
 * loyalty box, never the artwork proper and never the artist/copyright line, and the
 * image is otherwise untouched -- undistorted, uncropped, unfiltered.
 *
 * Offline is the fallback, not the failure: when the image cannot load (or the entry
 * is cardless), the standalone LoyaltyShield renders instead, so the loyalty a player
 * is mid-game with never depends on venue wifi.
 */
export function CardArtHero({ card, label, value, pending, dead }: CardArtHeroProps) {
  const url = cardImageUrl(card)
  const [failed, setFailed] = useState(false)
  // The badge waits for the pixels: a loyalty shield floating over the image's blank
  // placeholder box reads as broken during a slow load.
  const [loaded, setLoaded] = useState(false)

  if (!url || failed) {
    return <LoyaltyShield label={label} value={value} pending={pending} dead={dead} />
  }

  return (
    <div className="relative mx-auto w-full max-w-72" data-testid="card-art-hero">
      <img
        src={url}
        alt={`${card.name}, as printed`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        loading="lazy"
        className="w-full rounded-xl object-contain aspect-[488/680]"
      />
      {/* Over the printed loyalty box: bottom-right of the frame, above the artist
          line. Sized and placed as fractions of the card so it tracks every width. */}
      {loaded && (
        <div
          className={`absolute right-[4%] bottom-[4%] w-[21%] ${pending ? 'opacity-60' : ''}`}
          data-testid="loyalty-shield"
        >
          <LoyaltyBadge value={value} dead={dead} />
        </div>
      )}
    </div>
  )
}
