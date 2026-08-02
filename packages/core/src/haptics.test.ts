import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHapticsBackend, setHapticsBackend, tapHaptic } from './haptics'

describe('haptics', () => {
  beforeEach(() => {
    resetHapticsBackend()
  })

  it('does nothing before a host registers a backend', () => {
    // A missing tap is invisible; a crash is not. Silence is the safe default.
    resetHapticsBackend()
    expect(() => tapHaptic()).not.toThrow()
  })

  it('calls the registered backend', () => {
    const tap = vi.fn()
    setHapticsBackend(tap)

    tapHaptic()
    tapHaptic()

    expect(tap).toHaveBeenCalledTimes(2)
  })

  it('replaces a previously registered backend', () => {
    const first = vi.fn()
    const second = vi.fn()
    setHapticsBackend(first)
    setHapticsBackend(second)

    tapHaptic()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
