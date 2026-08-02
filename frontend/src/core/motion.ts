import { motion } from '../theme/tokens'

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Transition duration in ms for a given token, halved (floor 0) under reduced motion. */
export function transitionDuration(durationToken: keyof typeof motion.duration): number {
  return prefersReducedMotion() ? 0 : motion.duration[durationToken]
}
