import metadata from './metadata.generated.json'
import type { CardMetadata } from '../types'

/**
 * Every card the app knows about, generated from the Python registry by
 * `backend/tools/generate_parity_corpus.py`.
 *
 * Bundled rather than fetched. The list changes only when the app is rebuilt, so a
 * request for it was a round trip to learn something the bundle already had -- and it
 * meant the Cards tab needed a connection to show anything at all. The backend still
 * serves `/api/cards` as canonical data; nothing in the app reads it.
 */
export const CARDS: CardMetadata[] = metadata as CardMetadata[]

export function findCard(cardId: string): CardMetadata | undefined {
  return CARDS.find((card) => card.id === cardId)
}
