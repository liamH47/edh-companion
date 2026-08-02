import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CARDS, findCard } from './cards/cards'
import { computeCard, resetComputeBackend, setComputeBackend } from './compute'

describe('compute backend', () => {
  beforeEach(() => {
    resetComputeBackend()
  })

  it('computes locally by default, with no network at all', () => {
    // The whole point: the Cards tab works with no connection, the same as Swiss and
    // Coin Flip already did.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const bloodArtist = findCard('blood-artist')!
    const outputs = computeCard(bloodArtist, { creatures_died: 4, drain_effect_count: 3 })

    expect(outputs).toEqual({ total_life_drained: 12 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('applies field defaults for anything omitted', () => {
    const bloodArtist = findCard('blood-artist')!
    // drain_effect_count defaults to 1.
    expect(computeCard(bloodArtist, { creatures_died: 4 })).toEqual({ total_life_drained: 4 })
  })

  it('throws for input the card rejects, so the caller can surface it', () => {
    const bloodArtist = findCard('blood-artist')!
    expect(() => computeCard(bloodArtist, { creatures_died: -1 })).toThrow()
  })

  it('routes through a registered backend instead', () => {
    const local = vi.fn().mockReturnValue({ total_life_drained: 99 })
    setComputeBackend(local)

    const bloodArtist = findCard('blood-artist')!
    expect(computeCard(bloodArtist, { creatures_died: 1 })).toEqual({ total_life_drained: 99 })
    expect(local).toHaveBeenCalledWith(bloodArtist, { creatures_died: 1 })
  })

  it('goes back to local compute when reset', () => {
    setComputeBackend(vi.fn().mockReturnValue({ total_life_drained: 99 }))
    resetComputeBackend()

    const bloodArtist = findCard('blood-artist')!
    expect(computeCard(bloodArtist, { creatures_died: 2, drain_effect_count: 2 })).toEqual({
      total_life_drained: 4,
    })
  })
})

describe('bundled card metadata', () => {
  it('carries every registered card', () => {
    expect(CARDS.length).toBeGreaterThan(0)
    expect(CARDS.map((card) => card.id)).toContain('scute-swarm')
  })

  it('finds a card by id', () => {
    expect(findCard('grapeshot')?.name).toBe('Grapeshot')
  })

  it('is undefined for an id no card uses', () => {
    expect(findCard('not-a-card')).toBeUndefined()
  })
})
