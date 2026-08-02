import { motion } from './theme/tokens'

/**
 * Whether the player asked for reduced motion, behind a host-registered backend.
 *
 * Read synchronously, at render time, by every animated component. The web can answer
 * synchronously (`matchMedia`); React Native cannot (`AccessibilityInfo` is async), so
 * a native host caches the answer at startup and keeps it fresh with a listener. That
 * asymmetry is exactly why this is a seam and not a direct call.
 */
const noPreference = () => false
let reducedMotion = noPreference

export function setReducedMotionSource(source: () => boolean): void {
  reducedMotion = source
}

/** Back to assuming no preference. For tests. */
export function resetReducedMotionSource(): void {
  reducedMotion = noPreference
}

export function prefersReducedMotion(): boolean {
  return reducedMotion()
}

/** A named duration from the token scale, honouring the preference: reduced motion
 * collapses every animation to nothing rather than merely shortening it. */
export function transitionDuration(speed: keyof typeof motion.duration = 'base'): number {
  return prefersReducedMotion() ? 0 : motion.duration[speed]
}
