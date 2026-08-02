import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playLoseSound, playWinSound, resetSoundBackend, setSoundEnabled } from '@mtg/core'
import { registerWebSound } from './sound'

/**
 * The web half of the sound seam. The preference and the enabled check are core's and
 * tested there; what is web-shaped -- and so tested here -- is that a clip is
 * constructed and played, and that a `play()` returning undefined does not blow up.
 */
describe('registerWebSound', () => {
  let played: string[]
  let playResult: unknown

  beforeEach(() => {
    played = []
    playResult = Promise.resolve()
    resetSoundBackend()
    setSoundEnabled(true)
    vi.stubGlobal(
      'Audio',
      class {
        constructor(url: string) {
          played.push(url)
        }
        play() {
          return playResult
        }
      },
    )
    registerWebSound()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays the win clip', () => {
    playWinSound()
    expect(played).toEqual(['/sounds/win.mp3'])
  })

  it('plays the lose clip', () => {
    playLoseSound()
    expect(played).toEqual(['/sounds/lose.mp3'])
  })

  it('plays nothing while sound is switched off', () => {
    setSoundEnabled(false)
    playWinSound()
    playLoseSound()
    expect(played).toEqual([])
  })

  it('survives a rejected play, which autoplay policies cause routinely', async () => {
    playResult = Promise.reject(new Error('autoplay blocked'))
    expect(() => playWinSound()).not.toThrow()
    await Promise.resolve()
  })

  it('survives play() returning undefined, as jsdom and older browsers do', () => {
    playResult = undefined
    expect(() => playWinSound()).not.toThrow()
  })
})
