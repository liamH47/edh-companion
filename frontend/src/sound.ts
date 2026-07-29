const SOUND_STORAGE_KEY = 'mtg-calc-sound-enabled'

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off')
}

const WIN_SOUND_URL = '/sounds/win.mp3'
const LOSE_SOUND_URL = '/sounds/lose.mp3'

/** Plays a clip fresh each time (avoids restart/currentTime races if flips happen in quick
 * succession). Playback failures are swallowed -- a sound effect that fails to play
 * (autoplay policy, slow network) should never break the app. */
function playClip(url: string): void {
  if (!isSoundEnabled()) return
  new Audio(url).play().catch(() => {})
}

export function playWinSound(): void {
  playClip(WIN_SOUND_URL)
}

export function playLoseSound(): void {
  playClip(LOSE_SOUND_URL)
}
