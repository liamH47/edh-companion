import type { CardMetadata } from './types'

/**
 * Where the "View card" button points.
 *
 * Scryfall serves card images for exactly this purpose -- building Magic software under
 * Wizards' Fan Content Policy -- with rules this app has to keep holding to:
 *
 *   - Do not crop or cover the copyright and artist line. We show the **full** card
 *     image, which satisfies this by construction. An `art_crop` would instead oblige us
 *     to surface the artist and copyright elsewhere in the same view.
 *   - Do not distort, skew or stretch. The view must letterbox rather than fill.
 *   - Do not recolor, blur or desaturate. No filters, and no dimming the image itself to
 *     match a dark theme -- dim the surround instead.
 *   - Do not add watermarks or logos over it.
 *   - Do not imply anyone other than Wizards created the card.
 *
 * The id resolves through api.scryfall.com, which 302s to their CDN. Going through the
 * API rather than storing a CDN path keeps the reference durable: the redirect target
 * can change without every card module needing a new URL.
 */
const IMAGE_ENDPOINT = 'https://api.scryfall.com/cards'

/** `normal` is ~488x680 -- large enough to read at arm's length, small enough that a
 * phone on venue wifi does not wait on it. `large` and `png` exist if that changes. */
export type CardImageVersion = 'small' | 'normal' | 'large'

/**
 * The card's image URL, or null when there is no card behind the entry.
 *
 * Null is a real case rather than defensive coding: `scryfall_id` is optional in the
 * schema so a future entry can be a format mechanic (commander tax) that no single card
 * represents. Callers render the button only when this returns a URL.
 */
export function cardImageUrl(
  card: Pick<CardMetadata, 'scryfall_id'>,
  version: CardImageVersion = 'normal',
): string | null {
  if (!card.scryfall_id) return null
  return `${IMAGE_ENDPOINT}/${card.scryfall_id}?format=image&version=${version}`
}
