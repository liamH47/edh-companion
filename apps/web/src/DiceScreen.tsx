import { useEffect, useRef, useState } from 'react'
import { playLoseSound, playRollSound, revealDuration, rollDice, tapHaptic } from '@mtg/core'
import { TumblingDie } from './cards/TumblingDie'
import { Button } from './ui/Button'
import { SegmentedControl, type SegmentedOption } from './ui/SegmentedControl'
import { Text } from './ui/Text'

type DiceMode = 'd6' | '2d6' | 'd20'

const CONFIG: Record<DiceMode, { count: number; faces: number }> = {
  d6: { count: 1, faces: 6 },
  '2d6': { count: 2, faces: 6 },
  d20: { count: 1, faces: 20 },
}

const MODES: SegmentedOption<DiceMode>[] = [
  { value: 'd6', label: 'd6' },
  { value: '2d6', label: '2d6' },
  { value: 'd20', label: 'd20' },
]

/** Faces that carry a shared "bad roll" meaning: a d20 natural 1 (crit fail) and 2d6
 * snake eyes (craps). A lone 1 on a plain d6 has no such convention, so it is not a
 * failure -- it plays the neutral roll sound like any other d6 result. */
function isFailure(mode: DiceMode, results: number[]): boolean {
  if (mode === '2d6') return results.every((face) => face === 1)
  if (mode === 'd20') return results[0] === 1
  return false
}

function announce(results: number[]): string {
  if (results.length === 2) {
    const [a, b] = results
    return `Rolled ${a} and ${b} — sum ${a + b}`
  }
  return `Rolled ${results[0]}`
}

/**
 * A general dice roller: d6, two d6, or a d20. One "Roll" button drives however many dice
 * the mode has; the outcome is decided up front and revealed together off a single timer,
 * so 2d6's sum is committed in one atomic update with one announcement -- there is no
 * second die landing on its own clock to race. `TumblingDie` supplies the visuals; this
 * screen owns the orchestration (mode, sum, sound).
 */
export function DiceScreen({ rng = Math.random }: { rng?: () => number }) {
  const [mode, setMode] = useState<DiceMode>('d6')
  const [results, setResults] = useState<number[]>([1])
  const [rolling, setRolling] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const timeoutRef = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)
  const durationMs = revealDuration()

  const { count, faces } = CONFIG[mode]

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const changeMode = (next: DiceMode) => {
    // The selector is disabled while rolling, so this only fires at rest; the resets are
    // defensive so no stale roll can survive a mode change.
    window.clearTimeout(timeoutRef.current)
    inFlight.current = false
    setRolling(false)
    setMode(next)
    setResults(Array.from({ length: CONFIG[next].count }, () => 1))
    setAnnouncement('')
  }

  const roll = () => {
    // Ref, not the `rolling` state, so a same-frame double tap is caught before the state
    // update that disables the button has flushed.
    if (inFlight.current) return
    inFlight.current = true
    tapHaptic()

    const landed = rollDice(count, faces, rng)
    setResults(landed)
    setRolling(true)
    setAnnouncement('')

    timeoutRef.current = window.setTimeout(() => {
      inFlight.current = false
      setRolling(false)
      setAnnouncement(announce(landed))
      if (isFailure(mode, landed)) playLoseSound()
      else playRollSound()
    }, durationMs)
  }

  const sum = results.reduce((total, face) => total + face, 0)

  return (
    <section className="flex flex-col items-center gap-5 py-4">
      <div className="w-full max-w-xs">
        <SegmentedControl
          options={MODES}
          value={mode}
          onChange={changeMode}
          label="Dice"
          disabled={rolling}
          itemBasis="0"
        />
      </div>

      {/* Keyed by mode so switching remounts the dice, clearing any prior visual state. */}
      <div key={mode} className="flex items-center justify-center gap-4">
        {results.map((face, index) => (
          <TumblingDie key={index} face={face} faces={faces} rolling={rolling} durationMs={durationMs} />
        ))}
      </div>

      {/* Visible sum for 2d6 -- the whole point of a roller is to not make the player add
          the pips in their head. Single dice show their own face. */}
      {mode === '2d6' && !rolling && announcement !== '' && (
        <div className="text-center">
          <Text as="p" variant="statTile">
            {sum}
          </Text>
          <Text as="p" variant="body" color="muted">
            {results[0]} + {results[1]}
          </Text>
        </div>
      )}

      <Button size="lg" onClick={roll} disabled={rolling}>
        {rolling ? 'Rolling…' : 'Roll'}
      </Button>

      {/* One combined announcement for the whole roll, so 2d6 reads as a single result. */}
      <div aria-live="polite" className="sr-only">
        {rolling ? '' : announcement}
      </div>
    </section>
  )
}
