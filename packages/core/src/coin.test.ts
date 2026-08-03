import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flipCoin, isCommanderModeEnabled, setCommanderModeEnabled } from './coin'
import { resetStorageBackend, setItem } from './storage'

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

describe('commander mode preference', () => {
  beforeEach(() => {
    resetStorageBackend()
  })

  it('is off for a first-time user with empty storage', () => {
    expect(isCommanderModeEnabled()).toBe(false)
  })

  it('remembers being switched on, and back off', () => {
    setCommanderModeEnabled(true)
    expect(isCommanderModeEnabled()).toBe(true)

    setCommanderModeEnabled(false)
    expect(isCommanderModeEnabled()).toBe(false)
  })

  it('treats any stored value that is not the literal "on" as off', () => {
    // The bug this guards: copying sound.ts's `!== 'off'` would make all of these enable
    // commander mode, defaulting a fresh install to the wrong screen.
    for (const garbage of ['true', '1', 'ON', 'yes', '', 'off']) {
      setItem('mtg-calc-coin-commander-mode', garbage)
      expect(isCommanderModeEnabled()).toBe(false)
    }
  })
})
