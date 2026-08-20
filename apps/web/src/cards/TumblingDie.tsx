import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from '@mtg/core/theme/tokens'
import { prefersReducedMotion, rollKeyframes, type DieKeyframe } from '@mtg/core'

/** Pip layout per face, on a 3x3 grid indexed 0..8 (0 = top-left, 4 = centre). */
const PIPS_BY_FACE: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const PIP_POSITIONS = [
  [28, 28], [50, 28], [72, 28],
  [28, 50], [50, 50], [72, 50],
  [28, 72], [50, 72], [72, 72],
] as const

/** How often the shown face changes while the die is in the air. Slow enough to read as
 * distinct faces rather than a grey blur, fast enough to feel like a real roll. */
const FACE_SWAP_INTERVAL_MS = 70

interface DieFaceProps {
  face: number
  faces: number
}

/**
 * Hand-written SVG, no icon font or sprite sheet (portability-rules.md) -- the same JSX
 * compiles under react-native-svg with an element-name swap.
 *
 * A die with more than six faces has no standard pip layout, so anything past d6 renders
 * the number instead. The same fallback fires defensively if a face outside 1..6 is ever
 * asked of a six-or-fewer die -- it renders the numeral rather than crashing on a missing
 * pip layout (which is what a 2d6 *sum* fed to one die would do).
 */
function DieFace({ face, faces }: DieFaceProps) {
  const pips = faces <= 6 ? PIPS_BY_FACE[face] : undefined
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="18" className="fill-surface-raised" />
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="18"
        fill="none"
        strokeWidth="3"
        className="stroke-border"
      />
      {pips ? (
        pips.map((slot) => (
          <circle
            key={slot}
            cx={PIP_POSITIONS[slot][0]}
            cy={PIP_POSITIONS[slot][1]}
            r="8"
            className="fill-text"
          />
        ))
      ) : (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="44"
          fontWeight="bold"
          className="fill-text"
        >
          {face}
        </text>
      )}
    </svg>
  )
}

/** The die sitting still: no offset, no spin, full size. */
const AT_REST: DieKeyframe = {
  durationMs: 0,
  translateX: 0,
  translateY: 0,
  rotateDeg: 0,
  scale: 1,
  easing: 'decelerate',
  contact: false,
}

function transformFor(frame: DieKeyframe): string {
  return `translate(${frame.translateX}px, ${frame.translateY}px) rotate(${frame.rotateDeg}deg) scale(${frame.scale})`
}

interface TumblingDieProps {
  /** The face to reveal once the die lands. A flicker plays while it is in the air. */
  face: number
  faces: number
  rolling: boolean
  durationMs: number
  /** Varies the resting angle and tumble between rolls. The owner supplies it from the
   * same RNG that picked the face, so a test can pin both. */
  seed?: number
}

/**
 * The die, purely as a visual: it is thrown, bounces along the contact schedule in
 * `dieAnimation.ts`, and settles at a slight angle showing `face`. It decides nothing --
 * no RNG, no result callback, no announcement. The owner (a card's `DieRoller`, or
 * `DiceScreen`) picks the outcome up front and drives `face`/`rolling`, which is what
 * lets `DiceScreen` land two dice off one shared timer and announce their sum once.
 *
 * Playback is a keyframe walk rather than one CSS transition: each frame sets a transform
 * and a duration, and a timer advances to the next. That is what CSS `@keyframes` would
 * do, but `@keyframes` has no React Native equivalent, whereas this maps directly onto
 * `Animated.sequence` (portability-rules.md).
 *
 * The face stops flickering at the last contact, not when the whole animation ends -- a
 * real die shows its number from the moment it stops moving, and the settle is the die
 * rocking flat with its result already visible.
 */
export function TumblingDie({ face, faces, rolling, durationMs, seed = 1 }: TumblingDieProps) {
  const [shownFace, setShownFace] = useState(face)
  const [frameIndex, setFrameIndex] = useState(-1)
  const intervalRef = useRef<number | undefined>(undefined)
  const timeoutRef = useRef<number | undefined>(undefined)

  const frames = useMemo(
    () => rollKeyframes(durationMs, seed, prefersReducedMotion()),
    [durationMs, seed],
  )
  // Everything from the final contact onward shows the real face: the die has landed and
  // is only settling.
  const landedAt = frames.reduce((last, frame, index) => (frame.contact ? index : last), 0)

  useEffect(() => {
    return () => {
      window.clearInterval(intervalRef.current)
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!rolling) {
      setFrameIndex(-1)
      setShownFace(face)
      return
    }

    setShownFace(face)
    setFrameIndex(0)

    let index = 0
    const advance = () => {
      index += 1
      if (index >= frames.length) return
      setFrameIndex(index)
      timeoutRef.current = window.setTimeout(advance, frames[index].durationMs)
    }
    timeoutRef.current = window.setTimeout(advance, frames[0].durationMs)

    intervalRef.current = window.setInterval(() => {
      // Purely decorative: cycles faces so the die reads as tumbling. The value that
      // counts is `face`, shown from the last contact onward.
      setShownFace((current) => (current % faces) + 1)
    }, FACE_SWAP_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalRef.current)
      window.clearTimeout(timeoutRef.current)
    }
  }, [rolling, face, faces, frames])

  const airborne = rolling && frameIndex > -1 && frameIndex < landedAt
  const frame = frameIndex > -1 ? frames[frameIndex] : AT_REST

  return (
    <div className="h-24 w-24">
      <div
        className="h-full w-full"
        // Only transform, and only via tokens -- the two things a React Native port can
        // animate identically (portability-rules.md).
        style={{
          transform: transformFor(frame),
          transition: `transform ${frame.durationMs}ms ${motion.easing[frame.easing]}`,
        }}
      >
        <DieFace face={airborne ? shownFace : face} faces={faces} />
      </div>
    </div>
  )
}
