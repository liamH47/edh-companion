import { getItem, setItem } from './storage'

const SOUND_STORAGE_KEY = 'mtg-calc-sound-enabled'

/**
 * Whether sound is on, and a seam for actually playing it.
 *
 * The preference is platform-free -- it is a string in storage. Playback is not: the
 * web uses `new Audio(url)`, React Native uses expo-audio and bundled assets. So the
 * preference lives here and playback goes through a backend the host app registers at
 * startup.
 *
 * A settable module-level singleton rather than React context, because callers are
 * plain functions (useCardSession's effect, CoinFlip's handler) that a context cannot
 * reach. The default is a no-op, so a host that never registers one is silent rather
 * than broken -- which is also what makes this safe in tests.
 */
export function isSoundEnabled(): boolean {
  return getItem(SOUND_STORAGE_KEY) !== 'off'
}

export function setSoundEnabled(enabled: boolean): void {
  setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off')
}

export interface SoundBackend {
  playWin(): void
  playLose(): void
}

const silent: SoundBackend = { playWin: () => {}, playLose: () => {} }
let backend: SoundBackend = silent

export function setSoundBackend(next: SoundBackend): void {
  backend = next
}

/** Back to silence. For tests. */
export function resetSoundBackend(): void {
  backend = silent
}

export function playWinSound(): void {
  if (isSoundEnabled()) backend.playWin()
}

export function playLoseSound(): void {
  if (isSoundEnabled()) backend.playLose()
}
