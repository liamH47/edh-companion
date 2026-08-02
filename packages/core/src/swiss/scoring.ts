import { opponentsIn, type Match, type Standing, type Tournament } from './types'

/**
 * Match points, game points and the four MTG tiebreakers, per the Magic Tournament
 * Rules (see docs/swiss-pairings.md for the citations). Everything is derived from
 * the Tournament on demand -- nothing is cached or stored -- so fixing a mis-entered
 * result from round 1 corrects every standing immediately.
 */

const MATCH_POINTS_WIN = 3
const MATCH_POINTS_DRAW = 1
const GAME_POINTS_WIN = 3
const GAME_POINTS_DRAW = 1

/** A bye is "considered to have won the match 2-0": 3 match points, 6 game points.
 * Exported because pairing.ts builds byes and this is the single definition. */
export const BYE_GAME_WINS = 2

/**
 * The MTR floors every win percentage so one disastrous opponent can't drag a
 * player's tiebreakers down disproportionately. The rules text writes it "0.33";
 * MTGO and most software use a true third, which is what this uses -- at pod scale
 * the two can never produce a different ordering.
 */
export const MINIMUM_WIN_PERCENTAGE = 1 / 3

/** Only matches someone has actually reported count toward any record. */
function reportedMatchesFor(entrantId: string, tournament: Tournament): Match[] {
  return tournament.rounds.flatMap((round) =>
    round.matches.filter(
      (match) => match.result !== null && match.entrantIds.includes(entrantId),
    ),
  )
}

type Outcome = 'win' | 'loss' | 'draw'

/**
 * One rule for every table size: whoever has the most game wins took the match, and
 * a tie at the top is a draw.
 *
 * That covers a 2-0, a 1-1 drawn match, a bye (a single entrant is trivially the sole
 * maximum), a four-player pod with one winner, and a pod that timed out with nobody
 * on a game win -- without a special case for any of them.
 */
function outcomeFor(match: Match, entrantId: string): Outcome {
  const { gameWins } = match.result!
  const index = match.entrantIds.indexOf(entrantId)
  const own = gameWins[index]
  const best = Math.max(...gameWins)

  if (own < best) return 'loss'
  return gameWins.filter((wins) => wins === best).length === 1 ? 'win' : 'draw'
}

export interface MatchRecord {
  wins: number
  losses: number
  draws: number
}

export function matchRecord(entrantId: string, tournament: Tournament): MatchRecord {
  const record: MatchRecord = { wins: 0, losses: 0, draws: 0 }

  for (const match of reportedMatchesFor(entrantId, tournament)) {
    const outcome = outcomeFor(match, entrantId)
    if (outcome === 'win') record.wins += 1
    else if (outcome === 'loss') record.losses += 1
    else record.draws += 1
  }

  return record
}

export function matchPointsFor(entrantId: string, tournament: Tournament): number {
  const { wins, draws } = matchRecord(entrantId, tournament)
  return wins * MATCH_POINTS_WIN + draws * MATCH_POINTS_DRAW
}

interface GameTally {
  points: number
  played: number
}

function gameTallyFor(entrantId: string, tournament: Tournament): GameTally {
  let points = 0
  let played = 0

  for (const match of reportedMatchesFor(entrantId, tournament)) {
    const { gameWins, gameDraws } = match.result!
    const own = gameWins[match.entrantIds.indexOf(entrantId)]
    // Everyone at the table played the same games, so the count is the whole match's
    // games however many people were in it -- a bye's [2] gives 2, a 2-1 gives 3, a
    // single-game pod gives 1.
    points += own * GAME_POINTS_WIN + gameDraws * GAME_POINTS_DRAW
    played += gameWins.reduce((total, wins) => total + wins, 0) + gameDraws
  }

  return { points, played }
}

function flooredPercentage(points: number, possible: number): number {
  // No completed rounds means no evidence either way, so the floor stands in rather
  // than dividing by zero.
  if (possible === 0) return MINIMUM_WIN_PERCENTAGE
  return Math.max(MINIMUM_WIN_PERCENTAGE, points / possible)
}

export function matchWinPercentage(entrantId: string, tournament: Tournament): number {
  const matchesPlayed = reportedMatchesFor(entrantId, tournament).length
  return flooredPercentage(matchPointsFor(entrantId, tournament), matchesPlayed * MATCH_POINTS_WIN)
}

export function gameWinPercentage(entrantId: string, tournament: Tournament): number {
  const { points, played } = gameTallyFor(entrantId, tournament)
  return flooredPercentage(points, played * GAME_POINTS_WIN)
}

/**
 * Everyone this entrant actually sat across from. A bye yields none -- which is the
 * MTR rule that byes contribute no opponent, falling straight out of the model rather
 * than needing a check.
 *
 * A pod contributes every other player in it, so beating three people counts three
 * opponents toward OMW%.
 */
export function opponentIdsFor(entrantId: string, tournament: Tournament): string[] {
  return reportedMatchesFor(entrantId, tournament).flatMap((match) =>
    opponentsIn(match, entrantId),
  )
}

function averageOverOpponents(
  entrantId: string,
  tournament: Tournament,
  percentageFor: (opponentId: string, tournament: Tournament) => number,
): number {
  const opponents = opponentIdsFor(entrantId, tournament)
  if (opponents.length === 0) return MINIMUM_WIN_PERCENTAGE
  const total = opponents.reduce((sum, id) => sum + percentageFor(id, tournament), 0)
  return total / opponents.length
}

/** Tiebreaker 1. Averages opponents' already-floored match-win percentages. */
export function opponentsMatchWinPercentage(entrantId: string, tournament: Tournament): number {
  return averageOverOpponents(entrantId, tournament, matchWinPercentage)
}

/** Tiebreaker 3. Same shape, over game-win percentage. */
export function opponentsGameWinPercentage(entrantId: string, tournament: Tournament): number {
  return averageOverOpponents(entrantId, tournament, gameWinPercentage)
}

/**
 * Full standings, sorted by the MTR's tiebreaker order: match points, then OMW%, then
 * GW%, then OGW%. Seat breaks any remaining tie so the order is stable rather than
 * dependent on how `entrants` happens to be arranged.
 */
export function computeStandings(tournament: Tournament): Standing[] {
  const rows = tournament.entrants.map((entrant) => {
    const { wins, losses, draws } = matchRecord(entrant.id, tournament)
    return {
      entrantId: entrant.id,
      seat: entrant.seat,
      matchPoints: matchPointsFor(entrant.id, tournament),
      wins,
      losses,
      draws,
      matchWinPercentage: matchWinPercentage(entrant.id, tournament),
      opponentsMatchWinPercentage: opponentsMatchWinPercentage(entrant.id, tournament),
      gameWinPercentage: gameWinPercentage(entrant.id, tournament),
      opponentsGameWinPercentage: opponentsGameWinPercentage(entrant.id, tournament),
    }
  })

  rows.sort(
    (a, b) =>
      b.matchPoints - a.matchPoints ||
      b.opponentsMatchWinPercentage - a.opponentsMatchWinPercentage ||
      b.gameWinPercentage - a.gameWinPercentage ||
      b.opponentsGameWinPercentage - a.opponentsGameWinPercentage ||
      a.seat - b.seat,
  )

  return rows.map(({ seat: _seat, ...row }, index) => ({ rank: index + 1, ...row }))
}
