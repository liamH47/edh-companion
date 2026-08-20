/**
 * The roll as a continuous orientation path: sample it at any t in [0, 1] and draw.
 *
 * The path is solved backwards from the landing. First the exact orientation that faces
 * the rolled value toward the camera (a rotationBetween solve, plus a bounded random
 * spin around the view axis so the die rests slightly askew without foreshortening the
 * face -- roll-only tilt keeps pips and numerals legible with a plain 2D rotation).
 * Then the flight is that orientation with extra whole tumbles in front of it, unwound
 * as t advances -- the tumble angle is parameterized directly (slerp cannot do this:
 * it always takes the shortest arc, so it would collapse two and a half turns into
 * half of one), fast early and slowing at each contact. The die always arrives exactly
 * where it must, and the tumble is still wild at the start.
 *
 * Timing reuses the same CONTACT_FRACTIONS the roll sound is synthesized from
 * (dieAnimation.ts), so the bounces stay on the soundtrack by construction.
 *
 * Pure and seeded: same seed, same roll. No DOM, no CSS -- the sampler returns numbers
 * for the web's SVG today and react-native-svg later.
 */

import { CONTACT_FRACTIONS } from '../dieAnimation'
import { faceForValue, faceNormal, geometryFor } from './geometry'
import { fromAxisAngle, multiply, rotationBetween, type Quaternion } from './project'

/** Height of the first hop as a fraction of the die's radius. Later hops decay. */
const FIRST_APEX = 1.4

/** How much bounce height survives each contact. Cloth, not a wooden table. */
const RESTITUTION = 0.55

/** Whole tumbles (full turns) unwound during the flight before the landing pose. */
const FLIGHT_TURNS = 2.5

/** The die comes to rest rotated at most this far around the view axis. Roll-only:
 * it never pitches the landed face away from the camera, so legibility is free. */
const MAX_REST_TILT_DEG = 12

/** The die reads nearer the viewer at the top of the first arc. */
const APEX_SCALE = 1.12

/** Deterministic small PRNG (Mulberry32), so a given seed always tumbles the same way. */
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

export interface TumblePose {
  /** Orientation to project the die at. */
  orientation: Quaternion
  /** Vertical offset in die radii; 0 = resting on the surface, negative = airborne
   * (SVG y grows downward). */
  offsetY: number
  /** Lateral wobble in die radii. Returns to 0 by the last contact. */
  offsetX: number
  /** 1 at rest; up to APEX_SCALE at the top of the first arc. */
  scale: number
}

export interface TumblePath {
  /** Sample the pose at normalized time t in [0, 1]. Clamped outside that range. */
  poseAt(t: number): TumblePose
  /** The final resting pose (t = 1), for reduced motion and decoration placement. */
  rest: TumblePose
}

/** Piecewise-quadratic hop: y(t) rises to `apex` and returns to 0, shaped like a real
 * ballistic arc (decelerate up, accelerate down). `t` is 0..1 within one hop. */
function hopHeight(t: number, apex: number): number {
  return apex * 4 * t * (1 - t)
}

/**
 * Build the roll for `value` on a die with `faces` faces.
 *
 * The same seed that varies the tumble also varies the rest tilt, so no two rolls end
 * at exactly the same angle -- but the *face* is always exactly the one rolled: that is
 * solved, never sampled.
 */
export function tumblePath(faces: number, value: number, seed: number): TumblePath {
  const random = prng(seed)
  const geometry = geometryFor(faces)
  const faceIndex = faceForValue(geometry, value)

  // Landing pose: rolled face exactly toward the camera (+z), then a bounded spin
  // around the view axis.
  const align = rotationBetween(faceNormal(geometry, faceIndex), [0, 0, 1])
  const tiltDeg = (random() * 2 - 1) * MAX_REST_TILT_DEG
  const tilt = fromAxisAngle([0, 0, 1], (tiltDeg * Math.PI) / 180)
  const rest = multiply(tilt, align)

  // Flight: the landing pose with FLIGHT_TURNS of extra tumble in front of it, around
  // an axis that varies by seed (never the view axis alone, or the tumble would read
  // as a flat spin). The remaining angle is applied directly per sample.
  const axis: readonly [number, number, number] = [
    random() * 2 - 1,
    random() * 2 - 1,
    0.4 + random() * 0.6,
  ]
  const totalAngle = FLIGHT_TURNS * 2 * Math.PI

  // Rotation progress is front-loaded: most of the tumble happens before the first
  // contact, and each later hop carries RESTITUTION times the previous one's share.
  const segments = CONTACT_FRACTIONS.length + 1
  const shares: number[] = []
  let share = 1
  for (let i = 0; i < segments; i += 1) {
    shares.push(share)
    share *= RESTITUTION
  }
  const totalShare = shares.reduce((sum, s) => sum + s, 0)

  const boundaries = [0, ...CONTACT_FRACTIONS, 1]
  /** Cumulative rotation progress at each boundary, 0..1. */
  const progressAt = [0]
  for (let i = 0; i < segments; i += 1) {
    progressAt.push(progressAt[i] + shares[i] / totalShare)
  }

  const drift = (random() * 2 - 1) * 0.35

  const poseAt = (rawT: number): TumblePose => {
    const t = Math.min(1, Math.max(0, rawT))

    // Which flight segment t falls in.
    let segment = 0
    while (segment < segments - 1 && t >= boundaries[segment + 1]) segment += 1
    const segmentStart = boundaries[segment]
    // Boundaries are strictly increasing (the dieAnimation test asserts it), so the
    // divisor cannot be zero.
    const local = (t - segmentStart) / (boundaries[segment + 1] - segmentStart)

    // Orientation: the not-yet-unwound remainder of the tumble, composed onto the
    // rest pose. At progress 1 the remainder is zero and the pose is exactly `rest`.
    const progress = progressAt[segment] + (progressAt[segment + 1] - progressAt[segment]) * local
    const orientation = multiply(rest, fromAxisAngle(axis, -totalAngle * (1 - progress)))

    // Height: a hop per segment, apex decaying per contact; the final segment is the
    // settle and stays on the surface.
    const isSettle = segment === segments - 1
    const apex = FIRST_APEX * Math.pow(RESTITUTION, segment)
    const offsetY = isSettle ? 0 : -hopHeight(local, apex)

    // Lateral wobble damps to zero across the bounces; none left for the settle.
    const wobble = isSettle ? 0 : drift * Math.pow(RESTITUTION, segment) * Math.sin(local * Math.PI)

    // Nearer the viewer at the first apex only; later hops are too small to sell it.
    const scale = segment === 0 ? 1 + (APEX_SCALE - 1) * hopHeight(local, 1) : 1

    return { orientation, offsetY, offsetX: wobble, scale }
  }

  return { poseAt, rest: poseAt(1) }
}
