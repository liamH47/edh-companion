import { useEffect, useRef, useState } from 'react'
import { tapHaptic } from '../core/haptics'
import { prefersReducedMotion } from '../core/motion'
import { motion } from '../theme/tokens'
import { Button } from '../ui/Button'
import { Text } from '../ui/Text'

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

const TUMBLE_DURATION_MS = 900
const REDUCED_TUMBLE_DURATION_MS = 150
/** How often the shown face changes while tumbling. Slow enough to read as distinct
 * faces rather than a grey blur, fast enough to feel like a real roll. */
const FACE_SWAP_INTERVAL_MS = 70
const SPIN_TURNS = 2

interface DieFaceProps {
  face: number
  faces: number
}

/**
 * Hand-written SVG, no icon font or sprite sheet (portability-rules.md) -- the same
 * JSX compiles under react-native-svg with an element-name swap.
 *
 * A die with more than six faces has no standard pip layout, so anything past d6
 * renders the number instead. Nothing declares one today; this just means adding a
 * d20 card later needs no changes here.
 */
function DieFace({ face, faces }: DieFaceProps) {
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
      {faces <= 6 ? (
        PIPS_BY_FACE[face].map((slot) => (
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

interface DieRollerProps {
  faces: number
  actionLabel: string
  disabled: boolean
  /** Called with the face rolled, once the tumble finishes -- so the log and the
   * outputs update when the die lands, not when the button is pressed. */
  onRolled: (face: number) => void
  /** Injectable so a test can assert a specific face instead of "some number". */
  rng?: () => number
}

/**
 * Rolls the die for the player instead of asking them what they rolled.
 *
 * The result is decided up front and only *revealed* when the tumble ends: the faces
 * flickering during the roll are decoration, and deciding at the end would let a
 * mid-roll unmount or a reduced-motion setting change the outcome. Randomness lives
 * here at the edge, so compute() stays a pure function of the resulting sequence.
 */
export function DieRoller({
  faces,
  actionLabel,
  disabled,
  onRolled,
  rng = Math.random,
}: DieRollerProps) {
  const [shownFace, setShownFace] = useState(1)
  const [rolling, setRolling] = useState(false)
  const [spins, setSpins] = useState(0)
  const timeoutRef = useRef<number | undefined>(undefined)
  const intervalRef = useRef<number | undefined>(undefined)

  const durationMs = prefersReducedMotion() ? REDUCED_TUMBLE_DURATION_MS : TUMBLE_DURATION_MS

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current)
      window.clearInterval(intervalRef.current)
    }
  }, [])

  const roll = () => {
    tapHaptic()
    const landedOn = Math.floor(rng() * faces) + 1

    setRolling(true)
    setSpins((current) => current + SPIN_TURNS)
    intervalRef.current = window.setInterval(() => {
      // Purely visual: cycles through faces so the die reads as tumbling. The value
      // that counts was already chosen above.
      setShownFace((current) => (current % faces) + 1)
    }, FACE_SWAP_INTERVAL_MS)

    timeoutRef.current = window.setTimeout(() => {
      window.clearInterval(intervalRef.current)
      setShownFace(landedOn)
      setRolling(false)
      onRolled(landedOn)
    }, durationMs)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-24 w-24"
        // Rotation and opacity only -- the two properties React Native can animate the
        // same way (portability-rules.md).
        style={{
          transform: `rotate(${spins * 360}deg)`,
          transition: `transform ${durationMs}ms ${motion.easing.decelerate}`,
          opacity: rolling ? 0.85 : 1,
        }}
      >
        <DieFace face={shownFace} faces={faces} />
      </div>

      {/* The face is announced rather than shown as text, so a screen reader hears the
          result the sighted player reads off the die. Only once it has landed. */}
      <div aria-live="polite" className="sr-only">
        {rolling ? '' : `Rolled ${shownFace}`}
      </div>

      <Button size="lg" fullWidth disabled={disabled || rolling} onClick={roll}>
        {rolling ? 'Rolling…' : actionLabel}
      </Button>

      {disabled && !rolling && (
        <Text variant="body" color="muted">
          No activations left this turn.
        </Text>
      )}
    </div>
  )
}
