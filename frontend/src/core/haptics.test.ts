import { afterEach, describe, expect, it, vi } from 'vitest'
import { tapHaptic } from './haptics'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tapHaptic', () => {
  it('calls navigator.vibrate with a short duration when available', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    tapHaptic()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('does not throw when navigator.vibrate is unavailable', () => {
    const { vibrate: _vibrate, ...rest } = navigator as Navigator & { vibrate?: unknown }
    vi.stubGlobal('navigator', rest)
    expect(() => tapHaptic()).not.toThrow()
  })
})
