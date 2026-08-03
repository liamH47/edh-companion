import { useEffect, useRef, useState } from 'react'
import { rollDie, tapHaptic } from '@mtg/core'
import { revealDuration } from '@mtg/core'
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
  const [rolling, setRolling] = useState(false)
  const timeoutRef = useRef<number | undefined>(undefined)

  const durationMs = revealDuration()

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const roll = () => {
    tapHaptic()
    const landedOn = rollDie(faces, rng)

    setFace(landedOn)
    setRolling(true)
    timeoutRef.current = window.setTimeout(() => {
      setRolling(false)
      onRolled(landedOn)
    }, durationMs)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <TumblingDie face={face} faces={faces} rolling={rolling} durationMs={durationMs} />

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
