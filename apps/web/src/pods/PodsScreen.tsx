import { useState } from 'react'
import { usePodSession } from '@mtg/core/pods'
import type { Rng } from '@mtg/core/swiss'
import { BackButton } from '../ui/BackButton'
import { Button } from '../ui/Button'
import { ConfirmSheet } from '../ui/ConfirmSheet'
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
  // Resume on the latest round, not round 1: a refresh mid-night reloads the session
  // from storage, and the current seating is the only round anyone is looking for.
  const [visibleRound, setVisibleRound] = useState(
    () => session.session?.rounds.length || 1,
  )
  const [resetOpen, setResetOpen] = useState(false)

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
        <BackButton onClick={onBack} label="Pairings" />
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

      <Button variant="ghost" fullWidth onClick={() => setResetOpen(true)}>
        Start over
      </Button>

      <ConfirmSheet
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          session.reset()
          setResetOpen(false)
          setVisibleRound(1)
        }}
        title="Start the night over?"
        message="The roster and every round played so far are discarded, and you go back to entering names. Nobody's seating history survives, so future rounds can pair people who have already played."
        confirmLabel="Start over"
      />
    </section>
  )
}
