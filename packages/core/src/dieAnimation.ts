import { motion } from './theme/tokens'

export type DieEasing = keyof typeof motion.easing

/**
 * When the die touches the surface, as fractions of the roll's total duration.
 *
 * This is the single source of truth for the *rhythm* of a roll, and it is shared:
 * `backend/tools/generate_roll_sound.py` reads these numbers out of this file and puts
 * one impact at each, so the thud you hear happens on the frame the die lands rather
 * than near it. Change a number here and both move. A hand-kept second copy in the
 * generator would drift apart within a release or two, which is the whole reason the
 * script parses this array instead of restating it.
 *
 * Against `REVEAL_DURATION_MS` (900) these are 260, 438, 591 and 720ms: a long first
 * flight, then hops of 178, 153 and 129ms as the die loses energy, and a 180ms settle
 * after the last contact. That gap sequence is the "slow tumble" rhythm, chosen by ear
 * from a set of candidates before it was ever an animation.
 */
export const CONTACT_FRACTIONS = [0.289, 0.487, 0.657, 0.8] as const

/**
 * How long the die is in the air before its first contact, as a fraction of the roll.
 *
 * The sound starts at the *first impact*, not at the button press -- there is nothing to
 * hear while the die is still in the air. The caller delays playback by this much rather
 * than the asset carrying leading silence, so the same clip stays reusable at any
 * duration.
 */
export const FIRST_CONTACT_FRACTION = CONTACT_FRACTIONS[0]

/** Height of the first hop, in px. Later hops decay from this. */
const FIRST_APEX_PX = 32

/** How much height survives each bounce. Real dice are around 0.4-0.6 on cloth. */
const RESTITUTION = 0.55

/** Lateral wobble, in px, damped toward zero. The die must finish centred -- the box it
 * lives in is fixed -- so this is a wobble rather than net travel. */
const DRIFT_PX = [9, -6, 4, -2] as const

/** Total spin before the resting angle is applied. Distributed across the flight, most
 * of it early, so the die visibly slows rather than stopping dead. */
const TOTAL_SPIN_DEG = 900

/** How far off-square the die is allowed to come to rest. A die that lands on an exact
 * multiple of 360 reads as a spinner that stopped; a few degrees of tilt reads as an
 * object that fell over. */
const MAX_REST_TILT_DEG = 12

/** Scale at the top of the first arc -- the die reads as nearer the viewer mid-flight. */
const APEX_SCALE = 1.12

export interface DieKeyframe {
  durationMs: number
  translateX: number
  translateY: number
  /** Absolute, not relative: the accumulated rotation at the end of this frame. */
  rotateDeg: number
  scale: number
  easing: DieEasing
  /** True when this frame ends with the die touching down. The view can hang a haptic
   * tick on it, and it is what the sound's impacts are aligned to. */
  contact: boolean
}

/** Deterministic small PRNG, so a given seed always tumbles the same way. Mulberry32. */
function prng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The roll, as a list of keyframes to play in order.
 *
 * Each airborne stretch becomes two frames -- a rise that decelerates into the apex and a
 * fall that accelerates into the surface -- because that pair *is* the read of gravity.
 * One frame per hop with a single easing looks like a float. The last frame is the settle:
 * no vertical movement, just the rotation easing onto its resting tilt.
 *
 * Under reduced motion this collapses to that settle frame alone. It does not collapse to
 * nothing, for the reason `revealDuration` documents: the animation is the result being
 * shown, so removing it entirely reads as a bug rather than an accessibility win.
 *
 * Pure, and returns plain numbers only -- no DOM, no CSS strings -- so the same sequence
 * drives a web `transform` today and an `Animated.sequence` on React Native later.
 */
export function rollKeyframes(totalMs: number, seed: number, reduced = false): DieKeyframe[] {
  const random = prng(seed)
  const restTilt = Math.round((random() * 2 - 1) * MAX_REST_TILT_DEG)
  // The die must stop past its last full turn, not short of it, or the final frame plays
  // backwards. Round up to the next whole turn, then apply the tilt.
  const finalRotation = Math.ceil(TOTAL_SPIN_DEG / 360) * 360 + restTilt

  if (reduced) {
    return [
      {
        durationMs: totalMs,
        translateX: 0,
        translateY: 0,
        rotateDeg: restTilt,
        scale: 1,
        easing: 'decelerate',
        contact: true,
      },
    ]
  }

  const frames: DieKeyframe[] = []
  let apex = FIRST_APEX_PX
  let previousFraction = 0

  CONTACT_FRACTIONS.forEach((contactFraction, index) => {
    const flightMs = (contactFraction - previousFraction) * totalMs
    // Spin is spread over flight time, weighted so the early, longest flight carries most
    // of it. Squaring the remaining-energy term is what makes the slow-down visible.
    const energy = Math.pow(RESTITUTION, index)
    const spin = TOTAL_SPIN_DEG * (flightMs / totalMs) * (1 + energy) * 0.5
    const rotationAtApex = (frames[frames.length - 1]?.rotateDeg ?? 0) + spin * 0.55
    const drift = DRIFT_PX[index % DRIFT_PX.length]
    const apexScale = 1 + (APEX_SCALE - 1) * energy

    frames.push({
      durationMs: flightMs * 0.45,
      translateX: drift,
      translateY: -apex,
      rotateDeg: rotationAtApex,
      scale: apexScale,
      easing: 'decelerate',
      contact: false,
    })
    frames.push({
      durationMs: flightMs * 0.55,
      translateX: drift * 0.5,
      translateY: 0,
      rotateDeg: rotationAtApex + spin * 0.45,
      scale: 1,
      easing: 'accelerate',
      contact: true,
    })

    apex *= RESTITUTION
    previousFraction = contactFraction
  })

  frames.push({
    durationMs: (1 - previousFraction) * totalMs,
    translateX: 0,
    translateY: 0,
    rotateDeg: finalRotation,
    scale: 1,
    easing: 'decelerate',
    contact: false,
  })

  return frames
}

/** Total play time of a sequence. Equals the duration asked for, and the test says so --
 * a sequence that overruns would desync from the owner's reveal timer and the sound. */
export function totalDuration(frames: DieKeyframe[]): number {
  return frames.reduce((sum, frame) => sum + frame.durationMs, 0)
}

/** The CSS/RN transform for a frame, as an ordered triple the web joins into a string and
 * React Native passes as an array. Kept here so both hosts agree on the ORDER, which
 * changes the result. */
export function transformParts(frame: DieKeyframe): {
  translateX: number
  translateY: number
  rotate: number
  scale: number
} {
  return {
    translateX: frame.translateX,
    translateY: frame.translateY,
    rotate: frame.rotateDeg,
    scale: frame.scale,
  }
}
