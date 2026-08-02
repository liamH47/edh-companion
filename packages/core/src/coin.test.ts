import { afterEach, describe, expect, it, vi } from 'vitest'
import { flipCoin } from './coin'

describe('flipCoin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns heads when the random draw is below 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)
    expect(flipCoin()).toBe('heads')
  })

  it('returns tails when the random draw is 0.5 or above', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    expect(flipCoin()).toBe('tails')
  })
})
