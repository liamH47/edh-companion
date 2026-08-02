import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSoundEnabled,
  resetSoundBackend,
  playLoseSound,
  playWinSound,
  setSoundBackend,
  setSoundEnabled,
} from './sound'
import { resetStorageBackend } from './storage'

describe('sound', () => {
  beforeEach(() => {
    resetStorageBackend()
    resetSoundBackend()
  })

  it('is on until switched off', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('remembers being switched off, and back on', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)

    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('plays through the registered backend', () => {
    const backend = { playWin: vi.fn(), playLose: vi.fn() }
    setSoundBackend(backend)

    playWinSound()
    playLoseSound()

    expect(backend.playWin).toHaveBeenCalledOnce()
    expect(backend.playLose).toHaveBeenCalledOnce()
  })

  it('plays nothing while sound is switched off', () => {
    // The check lives here rather than in each backend, so a native host cannot
    // forget it.
    const backend = { playWin: vi.fn(), playLose: vi.fn() }
    setSoundBackend(backend)
    setSoundEnabled(false)

    playWinSound()
    playLoseSound()

    expect(backend.playWin).not.toHaveBeenCalled()
    expect(backend.playLose).not.toHaveBeenCalled()
  })

  it('is silent, not broken, before a host registers a backend', () => {
    expect(() => {
      playWinSound()
      playLoseSound()
    }).not.toThrow()
  })
})
