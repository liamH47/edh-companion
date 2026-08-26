import { useState } from 'react'
import { activeEntrantsForRound, entrantIdsInRound, isRoundComplete } from '@mtg/core/swiss'
import { entrantName, isBye, type MatchResult, type Tournament } from '@mtg/core/swiss'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { ConfirmSheet } from '../ui/ConfirmSheet'
import { EntrantBadge } from '../ui/EntrantBadge'
import { ShuffleIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'
import { MatchScoreRow } from './MatchScoreRow'

interface RoundScreenProps {
  tournament: Tournament
  roundNumber: number
  hadToRepeatPairing: boolean
  onReport: (roundNumber: number, matchId: string, result: MatchResult | null) => void
  onRepairFrom: (roundNumber: number) => void
  onSwap: (roundNumber: number, entrantAId: string, entrantBId: string) => void
  onNextRound: () => void
}

/**
 * One round's pairings, each an inline score card: tap a name to report a game win
 * (or set the pod winner), no sheet in between -- see MatchScoreRow for the
 * interaction rules. Editing an earlier round is the same surface; the one addition
 * there is the re-pair banner, since later rounds were paired from those results.
 *
 * Callers pass `key={roundNumber}` so the banner and swap state reset when the
 * visible round changes rather than leaking across rounds.
 */
export function RoundScreen({
  tournament,
  roundNumber,
  hadToRepeatPairing,
  onReport,
  onRepairFrom,
  onSwap,
  onNextRound,
}: RoundScreenProps) {
  const [swapFromId, setSwapFromId] = useState<string | null>(null)
  // Editing a round that later rounds were paired from doesn't re-pair them by itself
  // (people may already be seated) -- the banner surfaces the choice instead, and only
  // after an actual edit, so a mere look at an old round never dangles a destructive
  // offer.
  const [repairOffered, setRepairOffered] = useState(false)
  const [repairConfirmOpen, setRepairConfirmOpen] = useState(false)

  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)
  if (!round) {
    return (
      <Text variant="body" color="muted">
        Round {roundNumber} hasn&apos;t started yet.
      </Text>
    )
  }

  const nameById = new Map(tournament.entrants.map((entrant) => [entrant.id, entrant]))
  // A missing id degrades to the raw id rather than throwing -- the same guard
  // PodRoundScreen already applies. Without it a single dangling entrantId (a stale or
  // hand-edited saved tournament) throws through the one top-level ErrorBoundary and
  // blanks the entire app, not just this screen.
  const nameOf = (id: string) => {
    const entrant = nameById.get(id)
    return entrant ? entrantName(entrant) : id
  }

  const complete = isRoundComplete(tournament, roundNumber)
  const isLatestRound = roundNumber === tournament.rounds.length
  const hasLaterRounds = roundNumber < tournament.rounds.length
  const moreRoundsToPlay = tournament.rounds.length < tournament.totalRounds
  // If everyone left has dropped, the next round has no field to pair. Offering "Start
  // round" would spawn an empty round the pairer refuses to build anyway.
  const hasFieldForNextRound = activeEntrantsForRound(tournament, roundNumber + 1).length > 0

  const swapTargets = entrantIdsInRound(tournament, roundNumber).filter((id) => id !== swapFromId)

  const handleReport = (matchId: string, result: MatchResult | null) => {
    onReport(roundNumber, matchId, result)
    if (hasLaterRounds) setRepairOffered(true)
  }

  // A swap on an earlier round invalidates later pairings the same way a corrected
  // result does (possible once a decrement makes the round incomplete again).
  const handleSwap = (entrantAId: string, entrantBId: string) => {
    onSwap(roundNumber, entrantAId, entrantBId)
    if (hasLaterRounds) setRepairOffered(true)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text as="h2" variant="title">
          Round {roundNumber} of {tournament.totalRounds}
        </Text>
        <Chip>{complete ? 'Complete' : 'In progress'}</Chip>
      </div>

      {hadToRepeatPairing && isLatestRound && (
        <div role="alert" className="rounded-lg border border-border bg-surface-raised px-4 py-3">
          <Text variant="body" color="muted">
            Not enough fresh matchups remained, so this round repeats a pairing.
          </Text>
        </div>
      )}

      {/* role="status", not "alert": it follows the user's own edit rather than
          interrupting, and it keeps getByRole('alert') pointing only at the
          repeat-pairing banner (which is latest-round-only, so the two never share a
          screen). */}
      {repairOffered && hasLaterRounds && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3"
        >
          <Text variant="body" color="muted">
            Later rounds were already paired using these results. Standings update either
            way — re-pairing rebuilds those rounds from scratch.
          </Text>
          <Button variant="secondary" fullWidth onClick={() => setRepairConfirmOpen(true)}>
            Re-pair later rounds
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {round.matches.map((match) => (
          <li key={match.id} className="flex items-stretch gap-2">
            {isBye(match) ? (
              /* Nothing to report and nothing to press: a bye is pre-reported 2-0 the
                 moment it exists, and MTR gives its entrant no say in the matter. */
              <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2">
                <EntrantBadge name={nameOf(match.entrantIds[0])} />
                <Text variant="bodyStrong" className="min-w-0 flex-1 truncate">
                  {nameOf(match.entrantIds[0])}
                </Text>
                <Text variant="bodyStrong" color="accent" className="shrink-0">
                  Bye
                </Text>
              </div>
            ) : (
              <MatchScoreRow
                match={match}
                format={tournament.format}
                isPodEvent={tournament.eventFormat === 'commander'}
                names={match.entrantIds.map(nameOf)}
                onReport={(result) => handleReport(match.id, result)}
              />
            )}
            {!complete && !isBye(match) && (
              <Pressable
                aria-label={`Swap ${nameOf(match.entrantIds[0])} with another entrant`}
                onClick={() => setSwapFromId(match.entrantIds[0])}
                className="min-h-12 min-w-12 shrink-0 justify-center rounded-lg border border-border text-text-muted"
              >
                <ShuffleIcon />
              </Pressable>
            )}
          </li>
        ))}
      </ul>

      {/* Only the round's own primary action lives down here -- standings are one tap
          away in the pill row, and "End tournament" sits below in SwissScreen's own
          bottom block, shared by every view. */}
      {complete && isLatestRound && moreRoundsToPlay && (
        <div className="flex flex-col gap-2">
          {hasFieldForNextRound ? (
            <Button size="lg" fullWidth onClick={onNextRound}>
              Start round {roundNumber + 1}
            </Button>
          ) : (
            <div role="alert" className="rounded-lg border border-border bg-surface-raised px-4 py-3">
              <Text variant="body" color="muted">
                Every remaining entrant has dropped, so there is no field left to pair.
              </Text>
            </div>
          )}
        </div>
      )}

      <ConfirmSheet
        open={repairConfirmOpen}
        onCancel={() => setRepairConfirmOpen(false)}
        onConfirm={() => {
          onRepairFrom(roundNumber)
          setRepairConfirmOpen(false)
          setRepairOffered(false)
        }}
        title="Re-pair later rounds?"
        message="Every later round is rebuilt from the corrected results, and every result already reported in those rounds is discarded."
        confirmLabel="Re-pair"
      />

      <Sheet
        open={swapFromId !== null}
        onClose={() => setSwapFromId(null)}
        title={`Swap ${swapFromId ? nameOf(swapFromId) : ''} with`}
      >
        <div className="flex flex-col gap-2">
          <Text variant="body" color="muted">
            Both matches lose their reported result, since they no longer describe who played.
          </Text>
          {swapTargets.map((id) => (
            <Pressable
              key={id}
              onClick={() => {
                // Non-null: this sheet only renders while swapFromId is set.
                handleSwap(swapFromId!, id)
                setSwapFromId(null)
              }}
              className="min-h-12 justify-start rounded-lg border border-border bg-surface px-4"
            >
              <Text variant="body">{nameOf(id)}</Text>
            </Pressable>
          ))}
        </div>
      </Sheet>
    </section>
  )
}
