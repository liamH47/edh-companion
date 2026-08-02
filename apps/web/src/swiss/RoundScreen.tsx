import { useState } from 'react'
import { entrantIdsInRound, isRoundComplete } from '@mtg/core/swiss'
import { entrantName, isBye, type Match, type MatchResult, type Tournament } from '@mtg/core/swiss'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { ShuffleIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'
import { MatchResultSheet } from './MatchResultSheet'

interface RoundScreenProps {
  tournament: Tournament
  roundNumber: number
  hadToRepeatPairing: boolean
  onReport: (roundNumber: number, matchId: string, result: MatchResult | null) => void
  onRepairFrom: (roundNumber: number) => void
  onSwap: (roundNumber: number, entrantAId: string, entrantBId: string) => void
  onNextRound: () => void
}

function scoreline(match: Match): string {
  if (isBye(match)) return 'Bye'
  if (match.result === null) return 'Not reported'
  const { gameWins } = match.result
  const best = Math.max(...gameWins)
  // Tied at the top is a draw whatever the table size; otherwise show the scoreline.
  return gameWins.filter((wins) => wins === best).length > 1 ? 'Draw' : gameWins.join('-')
}

/**
 * One round's pairings: tap a match to report or correct it, swap two entrants if the
 * generated pairing needs a human fix, then move on. Editing a result from an earlier
 * round is the same flow -- MatchResultSheet offers the re-pair option when later
 * rounds already exist.
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
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [swapFromId, setSwapFromId] = useState<string | null>(null)

  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)
  if (!round) {
    return (
      <Text variant="body" color="muted">
        Round {roundNumber} hasn&apos;t started yet.
      </Text>
    )
  }

  const nameById = new Map(tournament.entrants.map((entrant) => [entrant.id, entrant]))
  const nameOf = (id: string) => entrantName(nameById.get(id)!)

  /** "Report A versus B" for a 1v1, "Report the pod with A, B, C" for a pod -- the
   * accessible name has to distinguish tables, and a four-name "versus" chain reads
   * badly aloud. */
  const reportLabel = (match: Match) => {
    if (isBye(match)) return `Report ${nameOf(match.entrantIds[0])} versus Bye`
    if (match.entrantIds.length === 2) {
      return `Report ${nameOf(match.entrantIds[0])} versus ${nameOf(match.entrantIds[1])}`
    }
    return `Report the pod with ${match.entrantIds.map(nameOf).join(', ')}`
  }

  const complete = isRoundComplete(tournament, roundNumber)
  const isLatestRound = roundNumber === tournament.rounds.length
  const hasLaterRounds = roundNumber < tournament.rounds.length
  const moreRoundsToPlay = tournament.rounds.length < tournament.totalRounds
  const editingMatch = round.matches.find((match) => match.id === editingMatchId) ?? null

  const swapTargets = entrantIdsInRound(tournament, roundNumber).filter((id) => id !== swapFromId)

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
            Everyone left had already played each other, so this round repeats a pairing.
          </Text>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {round.matches.map((match) => (
          <li key={match.id} className="flex items-stretch gap-2">
            <Pressable
              onClick={() => !isBye(match) && setEditingMatchId(match.id)}
              disabled={isBye(match)}
              aria-label={reportLabel(match)}
              className="min-h-12 min-w-0 flex-1 justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2 disabled:opacity-100"
            >
              {/* A 1v1 stacks the two sides, because the scoreline below is written
                  from the top one's point of view. A pod has no such hierarchy --
                  everyone is equally in it -- so it lists all its members at one
                  weight rather than promoting whoever happens to be first. */}
              {match.entrantIds.length > 2 ? (
                <Text variant="bodyStrong" className="min-w-0 flex-1 truncate text-left">
                  {match.entrantIds.map(nameOf).join(', ')}
                </Text>
              ) : (
                <span className="flex min-w-0 flex-col">
                  <Text variant="bodyStrong" className="truncate">
                    {nameOf(match.entrantIds[0])}
                  </Text>
                  <Text variant="body" color="muted" className="truncate">
                    {isBye(match) ? '—' : nameOf(match.entrantIds[1])}
                  </Text>
                </span>
              )}
              <Text
                variant="bodyStrong"
                color={match.result === null ? 'muted' : 'accent'}
                className="shrink-0"
              >
                {scoreline(match)}
              </Text>
            </Pressable>
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

      {/* Only the round's own primary action lives down here -- standings are always
          one tap away from the pill row above, so repeating them would put two
          competing buttons in the thumb zone. */}
      {complete && isLatestRound && moreRoundsToPlay && (
        <div
          className="flex flex-col gap-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Button size="lg" fullWidth onClick={onNextRound}>
            Start round {roundNumber + 1}
          </Button>
        </div>
      )}

      <MatchResultSheet
        open={editingMatch !== null}
        onClose={() => setEditingMatchId(null)}
        match={editingMatch}
        format={tournament.format}
        names={editingMatch ? editingMatch.entrantIds.map(nameOf) : []}
        onReport={(result) => editingMatch && onReport(roundNumber, editingMatch.id, result)}
        onRepair={hasLaterRounds ? () => onRepairFrom(roundNumber) : undefined}
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
                onSwap(roundNumber, swapFromId!, id)
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
