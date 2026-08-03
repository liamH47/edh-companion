import { useEffect, useRef, useState } from 'react'
import { motion } from '@mtg/core/theme/tokens'

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

/** How often the shown face changes while tumbling. Slow enough to read as distinct
 * faces rather than a grey blur, fast enough to feel like a real roll. */
const FACE_SWAP_INTERVAL_MS = 70
const SPIN_TURNS = 2

/** The landing "pop": a brief overshoot, then settle. State-driven (two phases) rather
 * than a CSS @keyframes bounce, so it maps onto Animated.sequence in a React Native port
 * -- @keyframes has no RN equivalent. */
const POP_SCALE = 1.08
const POP_MS = 120

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

interface TumblingDieProps {
  /** The face to reveal once the tumble ends. Ignored (a flicker plays) while `rolling`. */
  face: number
  faces: number
  rolling: boolean
  durationMs: number
}

/**
 * The die, purely as a visual: it flickers through faces while `rolling`, then reveals
 * `face` with a small pop when `rolling` goes false. It decides nothing -- no RNG, no
 * result callback, no announcement. The owner (a card's `DieRoller`, or `DiceScreen`)
 * picks the outcome up front and drives `face`/`rolling`, which is what lets `DiceScreen`
 * land two dice off one shared timer and announce their sum exactly once.
 */
export function TumblingDie({ face, faces, rolling, durationMs }: TumblingDieProps) {
  const [shownFace, setShownFace] = useState(face)
  const [spins, setSpins] = useState(0)
  const [popped, setPopped] = useState(false)
  const intervalRef = useRef<number | undefined>(undefined)
  const popTimeoutRef = useRef<number | undefined>(undefined)
  const wasRolling = useRef(false)

  useEffect(() => {
    return () => {
      window.clearInterval(intervalRef.current)
      window.clearTimeout(popTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (rolling) {
      wasRolling.current = true
      setSpins((current) => current + SPIN_TURNS)
      intervalRef.current = window.setInterval(() => {
        // Purely visual: cycles faces so the die reads as tumbling. The value that
        // counts is `face`, revealed below when the roll ends.
        setShownFace((current) => (current % faces) + 1)
      }, FACE_SWAP_INTERVAL_MS)
      return () => window.clearInterval(intervalRef.current)
    }

    setShownFace(face)
    // Pop only when a roll just finished -- not on the initial mount, where `rolling`
    // is already false and nothing was tumbling.
    if (wasRolling.current) {
      wasRolling.current = false
      setPopped(true)
      popTimeoutRef.current = window.setTimeout(() => setPopped(false), POP_MS)
    }
  }, [rolling, face, faces])

  return (
    <div
      className="h-24 w-24"
      // Rotation and opacity only on the outer element -- the two properties React Native
      // animates the same way (portability-rules.md).
      style={{
        transform: `rotate(${spins * 360}deg)`,
        transition: `transform ${durationMs}ms ${motion.easing.decelerate}`,
        opacity: rolling ? 0.85 : 1,
      }}
    >
      <div
        className="h-full w-full"
        // Scale kept on a nested element so its short pop timing doesn't fight the long
        // spin transition above.
        style={{
          transform: `scale(${popped ? POP_SCALE : 1})`,
          transition: `transform ${POP_MS}ms ${motion.easing.decelerate}`,
        }}
      >
        <DieFace face={shownFace} faces={faces} />
      </div>
    </div>
  )
}
