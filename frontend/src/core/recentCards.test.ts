import { afterEach, describe, expect, it } from 'vitest'
import { getRecentCardIds, recordCardOpened, sortByRecency } from './recentCards'

afterEach(() => {
  localStorage.clear()
})

describe('getRecentCardIds / recordCardOpened', () => {
  it('is empty before anything is recorded', () => {
    expect(getRecentCardIds()).toEqual([])
  })

  it('records an opened card at the front', () => {
    recordCardOpened('aetherflux-reservoir')
    expect(getRecentCardIds()).toEqual(['aetherflux-reservoir'])
  })

  it('moves a re-opened card back to the front instead of duplicating it', () => {
    recordCardOpened('aetherflux-reservoir')
    recordCardOpened('craterhoof-behemoth')
    recordCardOpened('aetherflux-reservoir')
    expect(getRecentCardIds()).toEqual(['aetherflux-reservoir', 'craterhoof-behemoth'])
  })

  it('caps the list at 10 entries', () => {
    for (let i = 0; i < 12; i++) recordCardOpened(`card-${i}`)
    const recents = getRecentCardIds()
    expect(recents).toHaveLength(10)
    expect(recents[0]).toBe('card-11')
    expect(recents).not.toContain('card-0')
    expect(recents).not.toContain('card-1')
  })
})

describe('sortByRecency', () => {
  const cards = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ]

  it('returns the original order when nothing has been opened', () => {
    expect(sortByRecency(cards)).toEqual(cards)
  })

  it('puts recently opened cards first, most recent first', () => {
    recordCardOpened('c')
    recordCardOpened('a')
    expect(sortByRecency(cards).map((c) => c.id)).toEqual(['a', 'c', 'b'])
  })

  it('ignores a recent id that no longer matches any given card', () => {
    recordCardOpened('does-not-exist')
    recordCardOpened('b')
    expect(sortByRecency(cards).map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })
})
