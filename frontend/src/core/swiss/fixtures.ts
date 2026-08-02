import { reportResult } from './tournament'
import { isBye, type Match, type MatchResult, type Rng, type Tournament } from './types'

/**
 * Test-only builders. Kept beside the modules they exercise rather than duplicated
 * across four spec files, since a Swiss fixture is several nested objects deep and
 * hand-writing one per test would bury the behaviour being asserted.
 */

export function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    mode: 'solo',
    format: 'bo3',
    totalRounds: 3,
    entrants: [],
    rounds: [],
    ...overrides,
  }
}

/**
 * Spreadsheet-column labels: A..Z, then AA, AB... A plain `String.fromCharCode(65 +
 * index)` runs off the end of the alphabet at 26 and starts emitting `[`, `\`, `]`,
 * which matters now that the integration sweep goes well past a single pod.
 */
export function entrantLabel(index: number): string {
  let label = ''
  let remaining = index
  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)
  return label
}

/** `count` entrants named A, B, C... seated in that order. */
export function makeEntrants(count: number): Tournament['entrants'] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `entrant-${index + 1}`,
    members: [entrantLabel(index)],
    seat: index + 1,
    droppedAfterRound: null,
  }))
}

/** A 1v1 scoreline, kept in A-then-B order because that is how tests read. Pods build
 * their results with `podResult`. */
export function result(aGameWins: number, bGameWins: number, gameDraws = 0): MatchResult {
  return { gameWins: [aGameWins, bGameWins], gameDraws }
}

/** A pod result: `winnerIndex` took it, or `null` for a draw among everyone. */
export function podResult(size: number, winnerIndex: number | null): MatchResult {
  return {
    gameWins: Array.from({ length: size }, (_unused, i) => (i === winnerIndex ? 1 : 0)),
    gameDraws: winnerIndex === null ? 1 : 0,
  }
}

/** `bEntrantId: null` builds a bye, matching how a match reads at the table. */
export function match(
  aEntrantId: string,
  bEntrantId: string | null,
  matchResult: MatchResult | null = null,
): Match {
  const entrantIds = bEntrantId === null ? [aEntrantId] : [aEntrantId, bEntrantId]
  return {
    id: bEntrantId === null ? `${aEntrantId}-vs-bye` : `${aEntrantId}-vs-${bEntrantId}`,
    entrantIds,
    result: matchResult,
  }
}

/** A pod of three or more. */
export function pod(entrantIds: string[], matchResult: MatchResult | null = null): Match {
  return { id: entrantIds.join('-vs-'), entrantIds, result: matchResult }
}

export function round(number: number, matches: Match[]): Tournament['rounds'][number] {
  return { number, matches }
}

/** A deterministic stand-in for Math.random that cycles the given values. Fine for a
 * single call site; use `mulberry32` for anything that draws repeatedly. */
export function seededRng(values: number[] = [0.5]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

/**
 * A real seeded PRNG, for runs that draw many times.
 *
 * `seededRng` cycles a fixed list, and `shuffle` consumes n-1 draws per call, so
 * across several rounds the "random" order correlates with the entrant count and the
 * same permutation keeps reappearing -- which silently makes a multi-round sweep test
 * far less than it looks. mulberry32 is four lines, has a full 2^32 period, and gives
 * a one-number repro for any failure.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Reports every unplayed match in a round, choosing each result with `decide`. Byes
 * are skipped: they arrive already reported as a 2-0, and reporting one again would
 * assert something the app never does.
 */
export function playRound(
  tournament: Tournament,
  roundNumber: number,
  decide: (match: Match) => MatchResult,
): Tournament {
  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)!
  return round.matches.reduce(
    (current, match) =>
      isBye(match) ? current : reportResult(current, roundNumber, match.id, decide(match)),
    tournament,
  )
}
