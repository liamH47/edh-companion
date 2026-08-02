import { setHapticsBackend, setReducedMotionSource, setStorageBackend } from '@mtg/core'
import { registerWebSound } from './sound'

/**
 * Fills in every platform seam `@mtg/core` leaves open, with the web's answers.
 *
 * Called once from the entry point, before anything renders -- several core callers
 * read storage during their first render, so registering later would mean the first
 * paint sees an empty store.
 *
 * A React Native host has a file exactly like this one: MMKV for storage, a cached
 * AccessibilityInfo value for motion, expo-haptics for the tap, expo-audio for sound.
 * Nothing else differs.
 */
export function registerWebPlatform(): void {
  setStorageBackend({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  })

  // Synchronous on the web. React Native has to cache an async answer instead, which
  // is the whole reason this is a seam.
  setReducedMotionSource(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  // Not supported on iOS Safari, hence the optional call -- a missing tap is fine.
  setHapticsBackend(() => navigator.vibrate?.(10))

  registerWebSound()
}
