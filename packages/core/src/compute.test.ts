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

    const nykthos = findCard('nykthos-shrine-to-nyx')!
    const outputs = computeCard(nykthos, { devotion_count: 4 })

    expect(outputs).toEqual({ mana_produced: 4, net_mana_after_activation_cost: 2 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('applies field defaults for anything omitted', () => {
    const nykthos = findCard('nykthos-shrine-to-nyx')!
    // devotion_count defaults to 0, and activating still costs {2}.
    expect(computeCard(nykthos, {})).toEqual({
      mana_produced: 0,
      net_mana_after_activation_cost: -2,
    })
  })

  it('throws for input the card rejects, so the caller can surface it', () => {
    const nykthos = findCard('nykthos-shrine-to-nyx')!
    expect(() => computeCard(nykthos, { devotion_count: -1 })).toThrow()
  })

  it('routes through a registered backend instead', () => {
    const local = vi.fn().mockReturnValue({ mana_produced: 99 })
    setComputeBackend(local)

    const nykthos = findCard('nykthos-shrine-to-nyx')!
    expect(computeCard(nykthos, { devotion_count: 1 })).toEqual({ mana_produced: 99 })
    expect(local).toHaveBeenCalledWith(nykthos, { devotion_count: 1 })
  })

  it('goes back to local compute when reset', () => {
    setComputeBackend(vi.fn().mockReturnValue({ mana_produced: 99 }))
    resetComputeBackend()

    const nykthos = findCard('nykthos-shrine-to-nyx')!
    expect(computeCard(nykthos, { devotion_count: 2 })).toEqual({
      mana_produced: 2,
      net_mana_after_activation_cost: 0,
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
