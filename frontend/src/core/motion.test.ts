import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, transitionDuration } from './motion'

function mockPrefersReducedMotion(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('prefersReducedMotion', () => {
  it('reflects the reduced-motion media query', () => {
    mockPrefersReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    mockPrefersReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('transitionDuration', () => {
  it('returns the token duration when motion is not reduced', () => {
    mockPrefersReducedMotion(false)
    expect(transitionDuration('sheet')).toBe(280)
  })

  it('returns 0 when the user prefers reduced motion', () => {
    mockPrefersReducedMotion(true)
    expect(transitionDuration('sheet')).toBe(0)
  })
})
