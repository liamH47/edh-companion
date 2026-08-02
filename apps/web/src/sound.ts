import { setSoundBackend } from '@mtg/core'

const WIN_SOUND_URL = '/sounds/win.mp3'
const LOSE_SOUND_URL = '/sounds/lose.mp3'

/**
 * The web half of the sound seam: preference and the enabled check live in
 * `@mtg/core`, and this supplies the only part that is actually web-shaped.
 *
 * Plays a clip fresh each time (avoids restart/currentTime races when flips happen in
 * quick succession). Playback failures are swallowed -- a sound effect that fails
 * (autoplay policy, slow network) should never break the app.
 */
function playClip(url: string): void {
  // `play()` returns a promise in modern browsers but `undefined` in older ones and in
  // jsdom, so the optional call is load-bearing rather than defensive noise.
  void new Audio(url).play()?.catch(() => {})
}

export function registerWebSound(): void {
  setSoundBackend({
    playWin: () => playClip(WIN_SOUND_URL),
    playLose: () => playClip(LOSE_SOUND_URL),
  })
}
