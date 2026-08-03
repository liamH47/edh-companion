import { useState } from 'react'
import { usePodSession } from '@mtg/core/pods'
import type { Rng } from '@mtg/core/swiss'
import { Button } from '../ui/Button'
import { Pressable } from '../ui/Pressable'
import { PodRoundScreen } from './PodRoundScreen'
import { PodSetupScreen } from './PodSetupScreen'

interface PodsScreenProps {
  /** Return to the pairings chooser. Non-destructive: a session in progress is kept
   * and resumed on the way back. */
  onBack: () => void
  /** Injected in tests so a shuffle is reproducible. */
  rng?: Rng
}

/**
 * The casual pods flow: roster setup, then a round of tables with a pill per round to
 * flip through history. No standings, no results -- just seating and reshuffling.
 */
export function PodsScreen({ onBack, rng = Math.random }: PodsScreenProps) {
  const session = usePodSession(rng)
  const [visibleRound, setVisibleRound] = useState(1)

  if (session.session === null) {
    return (
      <PodSetupScreen
        onBack={onBack}
        onStart={(names) => {
          session.start(names)
          setVisibleRound(1)
        }}
      />
    )
  }

  const rounds = session.session.rounds
  const latestRound = rounds.length
  const showRound = Math.min(visibleRound, latestRound)
  const round = rounds.find((candidate) => candidate.number === showRound)!

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack} className="mr-1">
          ‹ Pairings
        </Button>
        {rounds.map((candidate) => (
          <Pressable
            key={candidate.number}
            aria-current={candidate.number === showRound ? 'page' : undefined}
            onClick={() => setVisibleRound(candidate.number)}
            className={`min-h-12 min-w-12 justify-center rounded-pill border px-4 text-body font-semibold ${
              candidate.number === showRound
                ? 'border-accent bg-accent text-accent-text'
                : 'border-border bg-surface text-text'
            }`}
          >
            R{candidate.number}
          </Pressable>
        ))}
      </div>

      <PodRoundScreen
        session={session.session}
        round={round}
        isLatest={showRound === latestRound}
        onNextRound={() => {
          session.nextRound()
          setVisibleRound(latestRound + 1)
        }}
        onReshuffle={session.reshuffle}
      />

      <Button variant="ghost" fullWidth onClick={session.reset}>
        Start over
      </Button>
    </section>
  )
}
