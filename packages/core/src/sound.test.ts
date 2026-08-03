import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSoundEnabled,
  resetSoundBackend,
  playLoseSound,
  playRollSound,
  playWinSound,
  setSoundBackend,
  setSoundEnabled,
} from './sound'
import { resetStorageBackend } from './storage'

function spyBackend() {
  return { playWin: vi.fn(), playLose: vi.fn(), playRoll: vi.fn() }
}

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
    const backend = spyBackend()
    setSoundBackend(backend)

    playWinSound()
    playLoseSound()
    playRollSound()

    expect(backend.playWin).toHaveBeenCalledOnce()
    expect(backend.playLose).toHaveBeenCalledOnce()
    expect(backend.playRoll).toHaveBeenCalledOnce()
  })

  it('plays nothing while sound is switched off', () => {
    // The check lives here rather than in each backend, so a native host cannot
    // forget it.
    const backend = spyBackend()
    setSoundBackend(backend)
    setSoundEnabled(false)

    playWinSound()
    playLoseSound()
    playRollSound()

    expect(backend.playWin).not.toHaveBeenCalled()
    expect(backend.playLose).not.toHaveBeenCalled()
    expect(backend.playRoll).not.toHaveBeenCalled()
  })

  it('is silent, not broken, before a host registers a backend', () => {
    expect(() => {
      playWinSound()
      playLoseSound()
      playRollSound()
    }).not.toThrow()
  })
})
