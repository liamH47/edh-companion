import { describe, expect, it } from 'vitest'
import { COMPUTE_BY_CARD_ID, computeFor } from './registry'

describe('computeFor', () => {
  it('returns the compute for a registered card', () => {
    expect(computeFor('blood-artist')).toBe(COMPUTE_BY_CARD_ID['blood-artist'])
  })

  it('throws a named error for a card with no client-side compute', () => {
    // Reachable in one situation: a card exists in the backend registry but its
    // TypeScript port has not been written. The parity suite catches that at build
    // time; this is what the user would see if it somehow shipped anyway.
    expect(() => computeFor('not-a-card')).toThrow(
      'No client-side compute registered for card not-a-card',
    )
  })
})
