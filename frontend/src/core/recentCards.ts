import { getJSON, setJSON } from './storage'

const RECENT_CARDS_KEY = 'mtg-calc-recent-cards'
const MAX_RECENTS = 10

/** Most-recently-opened first. Persisted so a picker reopened later (or on a
 * different device pointed at the same storage) still reflects recent activity. */
export function getRecentCardIds(): string[] {
  return getJSON<string[]>(RECENT_CARDS_KEY, [])
}

export function recordCardOpened(cardId: string): void {
  const current = getRecentCardIds()
  const deduped = current.filter((id) => id !== cardId)
  setJSON(RECENT_CARDS_KEY, [cardId, ...deduped].slice(0, MAX_RECENTS))
}

/** All cards ordered most-recently-opened first, unopened cards after in their
 * original (registry) order -- what CardPickerScreen renders before any search. */
export function sortByRecency<T extends { id: string }>(cards: T[]): T[] {
  const recentIds = getRecentCardIds()
  const byId = new Map(cards.map((card) => [card.id, card]))
  const recent = recentIds.map((id) => byId.get(id)).filter((card): card is T => card != null)
  const recentIdSet = new Set(recentIds)
  const rest = cards.filter((card) => !recentIdSet.has(card.id))
  return [...recent, ...rest]
}
