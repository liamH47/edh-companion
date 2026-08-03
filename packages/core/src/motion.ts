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
 * collapses every animation to nothing rather than merely shortening it. The one
 * exception is an outcome-reveal animation -- see `revealDuration`. */
export function transitionDuration(speed: keyof typeof motion.duration = 'base'): number {
  return prefersReducedMotion() ? 0 : motion.duration[speed]
}

export const REVEAL_DURATION_MS = 900
export const REDUCED_REVEAL_DURATION_MS = 150

/**
 * Duration for an *outcome-reveal* animation -- the coin flip and the die roll -- which
 * is the documented exception to `transitionDuration`'s collapse-to-zero rule
 * (design-tokens.md). Here the animation *is* the result being shown: at zero the answer
 * would simply appear, with no sense that a flip or roll happened, which reads as a bug
 * rather than an accessibility win. So under reduced motion it *shortens* to a brief
 * fixed reveal instead of vanishing. One home for the pair of durations both the coin
 * and the die used to hardcode separately.
 */
export function revealDuration(): number {
  return prefersReducedMotion() ? REDUCED_REVEAL_DURATION_MS : REVEAL_DURATION_MS
}
