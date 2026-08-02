import type { Match, MatchResult, Tournament } from './types'

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

/** `count` entrants named A, B, C... seated in that order. */
export function makeEntrants(count: number): Tournament['entrants'] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `entrant-${index + 1}`,
    members: [String.fromCharCode(65 + index)],
    seat: index + 1,
    droppedAfterRound: null,
  }))
}

export function result(aGameWins: number, bGameWins: number, gameDraws = 0): MatchResult {
  return { aGameWins, bGameWins, gameDraws }
}

export function match(
  aEntrantId: string,
  bEntrantId: string | null,
  matchResult: MatchResult | null = null,
): Match {
  return {
    id: `${aEntrantId}-vs-${bEntrantId ?? 'bye'}`,
    aEntrantId,
    bEntrantId,
    result: matchResult,
  }
}

export function round(number: number, matches: Match[]): Tournament['rounds'][number] {
  return { number, matches }
}

/** A deterministic stand-in for Math.random that cycles the given values. */
export function seededRng(values: number[] = [0.5]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}
