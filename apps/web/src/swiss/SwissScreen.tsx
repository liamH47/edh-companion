import { useState } from 'react'
import { useTournament } from '@mtg/core/swiss'
import { entrantName, type Rng } from '@mtg/core/swiss'
import { BackButton } from '../ui/BackButton'
import { Button } from '../ui/Button'
import { ConfirmSheet } from '../ui/ConfirmSheet'
import { Pressable } from '../ui/Pressable'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'
import { RoundScreen } from './RoundScreen'
import { StandingsScreen } from './StandingsScreen'
import { TournamentSetupScreen } from './TournamentSetupScreen'

type View = 'round' | 'standings'

interface SwissScreenProps {
  /** Injected in tests so a multi-round event is reproducible. Rounds 2+ shuffle
   * within score groups, so with the real Math.random nothing past round 1 can be
   * asserted exactly. */
  rng?: Rng
  /** Return to the pairings chooser. Optional so the screen still stands alone in its
   * own tests; when set, a back link appears above the setup form. */
  onExit?: () => void
}

/**
 * The Swiss tab. Owns the tournament session and picks between setup, the current
 * round, and standings. No network anywhere below this point -- pairing and scoring
 * are pure functions in core/swiss, so a draft keeps working with the backend down.
 */
export function SwissScreen({ rng = Math.random, onExit }: SwissScreenProps = {}) {
  const session = useTournament(rng)
  const [view, setView] = useState<View>('round')
  // Resume on the round in progress, not round 1: a refresh mid-event reloads the
  // tournament from storage, and landing the TO back on R1 reads as lost data.
  const [visibleRound, setVisibleRound] = useState(
    () => session.tournament?.rounds.length || 1,
  )
  const [managingEntrants, setManagingEntrants] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const { tournament } = session

  if (tournament === null) {
    return (
      <div className="flex flex-col gap-4">
        {onExit && <BackButton onClick={onExit} label="Pairings" className="self-start" />}
        <TournamentSetupScreen
          rng={rng}
          onStart={(input, seatingIsRandom) => {
            session.start(input)
            session.nextRound(seatingIsRandom ? 'random' : 'draft-seating')
            setVisibleRound(1)
            setView('round')
          }}
        />
      </div>
    )
  }

  const latestRound = Math.max(1, tournament.rounds.length)
  const showRound = Math.min(visibleRound, latestRound)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {tournament.rounds.map((round) => (
          <Pressable
            key={round.number}
            aria-current={view === 'round' && round.number === showRound ? 'page' : undefined}
            onClick={() => {
              setVisibleRound(round.number)
              setView('round')
            }}
            className={`min-h-12 min-w-12 justify-center rounded-pill border px-4 text-body font-semibold ${
              view === 'round' && round.number === showRound
                ? 'border-accent bg-accent text-accent-text'
                : 'border-border bg-surface text-text'
            }`}
          >
            R{round.number}
          </Pressable>
        ))}
        <Pressable
          aria-current={view === 'standings' ? 'page' : undefined}
          onClick={() => setView('standings')}
          className={`min-h-12 justify-center rounded-pill border px-4 text-body font-semibold ${
            view === 'standings'
              ? 'border-accent bg-accent text-accent-text'
              : 'border-border bg-surface text-text'
          }`}
        >
          Standings
        </Pressable>
      </div>

      {view === 'standings' ? (
        <>
          <StandingsScreen tournament={tournament} />
          <Button variant="secondary" fullWidth onClick={() => setManagingEntrants(true)}>
            Manage drops
          </Button>
        </>
      ) : (
        <RoundScreen
          // Remount on round switch so per-round UI state (the re-pair banner, a
          // half-opened swap) never leaks from one round onto another.
          key={showRound}
          tournament={tournament}
          roundNumber={showRound}
          hadToRepeatPairing={session.hadToRepeatPairing}
          onReport={session.report}
          onRepairFrom={session.repairFrom}
          onSwap={session.swap}
          onNextRound={() => {
            session.nextRound()
            setVisibleRound(tournament.rounds.length + 1)
          }}
        />
      )}

      {/* On every view, not just standings: ending the night shouldn't require
          remembering which tab the button lives on. Ghost weight and last in the
          column -- the same quiet slot pods' "Start over" and cards' "Reset card"
          use -- and always behind the confirm below. */}
      <div
        className="flex flex-col gap-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button variant="ghost" fullWidth onClick={() => setEndOpen(true)}>
          End tournament
        </Button>
      </div>

      <Sheet
        open={managingEntrants}
        onClose={() => setManagingEntrants(false)}
        title="Drops"
      >
        <div className="flex flex-col gap-2">
          <Text variant="body" color="muted">
            A dropped entrant stops being paired but keeps counting in everyone else&apos;s
            tiebreakers — the matches they played still happened.
          </Text>
          {tournament.entrants.map((entrant) => {
            const dropped = entrant.droppedAfterRound !== null
            return (
              <Pressable
                key={entrant.id}
                aria-pressed={dropped}
                onClick={() =>
                  dropped
                    ? session.reinstate(entrant.id)
                    : session.drop(entrant.id, tournament.rounds.length)
                }
                className="min-h-12 justify-between rounded-lg border border-border bg-surface px-4"
              >
                <Text variant="body">{entrantName(entrant)}</Text>
                <Text variant="label" color={dropped ? 'danger' : 'muted'}>
                  {dropped ? 'Dropped — tap to rejoin' : 'Drop'}
                </Text>
              </Pressable>
            )
          })}
        </div>
      </Sheet>

      <ConfirmSheet
        open={endOpen}
        onCancel={() => setEndOpen(false)}
        onConfirm={() => {
          session.reset()
          setEndOpen(false)
          setVisibleRound(1)
          setView('round')
        }}
        title="End the tournament?"
        message="Every round, every reported result and the final standings are discarded. There is no record kept afterwards, so write down anything you still need first."
        confirmLabel="End tournament"
      />
    </section>
  )
}
