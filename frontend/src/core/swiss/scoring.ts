import type { Match, Standing, Tournament } from './types'

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

/** A bye is "considered to have won the match 2-0": 3 match points, 6 game points. */
const BYE_GAME_WINS = 2

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
      (match) =>
        match.result !== null &&
        (match.aEntrantId === entrantId || match.bEntrantId === entrantId),
    ),
  )
}

/** True when this match is `entrantId`'s bye (they were side A with no opponent). */
function isByeFor(match: Match, entrantId: string): boolean {
  return match.bEntrantId === null && match.aEntrantId === entrantId
}

export interface MatchRecord {
  wins: number
  losses: number
  draws: number
}

export function matchRecord(entrantId: string, tournament: Tournament): MatchRecord {
  let wins = 0
  let losses = 0
  let draws = 0

  for (const match of reportedMatchesFor(entrantId, tournament)) {
    const result = match.result!
    if (isByeFor(match, entrantId)) {
      wins += 1
      continue
    }
    const isSideA = match.aEntrantId === entrantId
    const own = isSideA ? result.aGameWins : result.bGameWins
    const opponent = isSideA ? result.bGameWins : result.aGameWins
    if (own > opponent) wins += 1
    else if (own < opponent) losses += 1
    else draws += 1
  }

  return { wins, losses, draws }
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
    const result = match.result!
    if (isByeFor(match, entrantId)) {
      points += BYE_GAME_WINS * GAME_POINTS_WIN
      played += BYE_GAME_WINS
      continue
    }
    const isSideA = match.aEntrantId === entrantId
    const own = isSideA ? result.aGameWins : result.bGameWins
    const opponent = isSideA ? result.bGameWins : result.aGameWins
    points += own * GAME_POINTS_WIN + result.gameDraws * GAME_POINTS_DRAW
    played += own + opponent + result.gameDraws
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

/** Everyone this entrant actually sat across from. Byes contribute no opponent, which
 * is why they're excluded from both opponents' percentages below. */
export function opponentIdsFor(entrantId: string, tournament: Tournament): string[] {
  const opponents: string[] = []
  for (const match of reportedMatchesFor(entrantId, tournament)) {
    if (match.bEntrantId === null) continue
    opponents.push(match.aEntrantId === entrantId ? match.bEntrantId : match.aEntrantId)
  }
  return opponents
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
