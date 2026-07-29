import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSoundEnabled, playLoseSound, playWinSound, setSoundEnabled } from './sound'

class MockAudio {
  static instances: MockAudio[] = []
  src: string
  play: () => Promise<void>

  constructor(src: string) {
    this.src = src
    this.play = vi.fn(() => Promise.resolve())
    MockAudio.instances.push(this)
  }
}

describe('sound', () => {
  beforeEach(() => {
    MockAudio.instances = []
    localStorage.clear()
    vi.stubGlobal('Audio', MockAudio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is enabled by default when nothing is stored', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('respects a stored disabled preference', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
  })

  it('respects a stored enabled preference', () => {
    setSoundEnabled(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('does not play any clip when sound is disabled', () => {
    setSoundEnabled(false)

    playWinSound()
    playLoseSound()

    expect(MockAudio.instances).toHaveLength(0)
  })

  it('plays the win clip when enabled', () => {
    setSoundEnabled(true)

    playWinSound()

    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0]?.src).toBe('/sounds/win.mp3')
    expect(MockAudio.instances[0]?.play).toHaveBeenCalledTimes(1)
  })

  it('plays the lose clip fresh each time when enabled', () => {
    setSoundEnabled(true)

    playLoseSound()
    playLoseSound()

    expect(MockAudio.instances).toHaveLength(2)
    for (const instance of MockAudio.instances) {
      expect(instance.src).toBe('/sounds/lose.mp3')
      expect(instance.play).toHaveBeenCalledTimes(1)
    }
  })

  it('does not throw when the browser rejects playback', async () => {
    class RejectingAudio {
      src: string
      play = vi.fn(() => Promise.reject(new Error('autoplay blocked')))
      constructor(src: string) {
        this.src = src
      }
    }
    vi.stubGlobal('Audio', RejectingAudio)
    setSoundEnabled(true)

    expect(() => playWinSound()).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
