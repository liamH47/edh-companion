import { computeStandings } from '@mtg/core/swiss'
import { entrantName, type Tournament } from '@mtg/core/swiss'
import { Text } from '../ui/Text'

interface StandingsScreenProps {
  tournament: Tournament
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Rank, record and all four tiebreakers. Built from flex rows rather than a table or
 * CSS grid (portability-rules.md), with the tiebreaker columns in a horizontally
 * scrollable strip so a phone shows name and record without squeezing them.
 */
export function StandingsScreen({ tournament }: StandingsScreenProps) {
  const standings = computeStandings(tournament)
  const nameById = new Map(tournament.entrants.map((entrant) => [entrant.id, entrant]))

  if (standings.length === 0) {
    return (
      <Text variant="body" color="muted">
        No entrants yet.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Text as="h2" variant="title">
        Standings
      </Text>

      <ul className="flex flex-col gap-2">
        {standings.map((standing) => {
          const entrant = nameById.get(standing.entrantId)!
          const dropped = entrant.droppedAfterRound !== null
          return (
            <li
              key={standing.entrantId}
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-baseline gap-3">
                <Text variant="statTile" className="w-6 shrink-0">
                  {standing.rank}
                </Text>
                <Text variant="bodyStrong" className="min-w-0 flex-1 truncate">
                  {entrantName(entrant)}
                  {dropped && (
                    <Text variant="label" color="muted">
                      {' '}
                      (dropped)
                    </Text>
                  )}
                </Text>
                <Text variant="bodyStrong" color="accent" className="shrink-0">
                  {standing.wins}-{standing.losses}-{standing.draws}
                </Text>
              </div>
              <div className="flex gap-3 overflow-x-auto">
                <Text variant="label" color="muted" className="shrink-0">
                  {standing.matchPoints} pts
                </Text>
                <Text variant="label" color="muted" className="shrink-0">
                  OMW {percent(standing.opponentsMatchWinPercentage)}
                </Text>
                <Text variant="label" color="muted" className="shrink-0">
                  GW {percent(standing.gameWinPercentage)}
                </Text>
                <Text variant="label" color="muted" className="shrink-0">
                  OGW {percent(standing.opponentsGameWinPercentage)}
                </Text>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
