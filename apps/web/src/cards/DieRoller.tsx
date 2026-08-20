import { useEffect, useRef, useState } from 'react'
import { rollDie, tapHaptic } from '@mtg/core'
import { FIRST_CONTACT_FRACTION, playRollSound, revealDuration } from '@mtg/core'
import { Button } from '../ui/Button'
import { Text } from '../ui/Text'
import { TumblingDie } from './TumblingDie'

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
 * Rolls the die for the player instead of asking them what they rolled. Owns the outcome
 * (RNG, the reveal timer, the announcement, the Comet-specific disabled copy) and hands
 * the visuals to `TumblingDie`.
 *
 * The result is decided up front and only *revealed* when the tumble ends: the faces
 * flickering during the roll are decoration, and deciding at the end would let a mid-roll
 * unmount or a reduced-motion setting change the outcome. Randomness lives here at the
 * edge, so compute() stays a pure function of the resulting sequence.
 */
export function DieRoller({
  faces,
  actionLabel,
  disabled,
  onRolled,
  rng = Math.random,
}: DieRollerProps) {
  const [face, setFace] = useState(1)
  const [seed, setSeed] = useState(1)
  const [rolling, setRolling] = useState(false)
  const timeoutRef = useRef<number | undefined>(undefined)
  const soundTimeoutRef = useRef<number | undefined>(undefined)

  const durationMs = revealDuration()

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current)
      window.clearTimeout(soundTimeoutRef.current)
    }
  }, [])

  const roll = () => {
    tapHaptic()
    const landedOn = rollDie(faces, rng)

    setFace(landedOn)
    // Varies the tumble and the resting angle between rolls. Drawn from the same rng the
    // face came from, so an injected rng pins the animation as well as the result.
    setSeed(Math.floor(rng() * 1_000_000))
    setRolling(true)
    // The clip starts at the die's first contact -- there is nothing to hear while it is
    // still in the air, and playing on the button press puts the thud before the landing.
    soundTimeoutRef.current = window.setTimeout(
      playRollSound,
      durationMs * FIRST_CONTACT_FRACTION,
    )
    timeoutRef.current = window.setTimeout(() => {
      setRolling(false)
      onRolled(landedOn)
    }, durationMs)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <TumblingDie
        face={face}
        faces={faces}
        rolling={rolling}
        durationMs={durationMs}
        seed={seed}
      />

      {/* The face is announced rather than shown as text, so a screen reader hears the
          result the sighted player reads off the die. Only once it has landed. */}
      <div aria-live="polite" className="sr-only">
        {rolling ? '' : `Rolled ${face}`}
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
