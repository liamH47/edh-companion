/**
 * Domain model for a Swiss tournament. Pure data -- no React, no DOM, no storage --
 * so the pairing and scoring modules beside it port to React Native untouched.
 *
 * Two-Headed Giant is modeled by giving an Entrant two `members` rather than by
 * branching anywhere in the pairing or scoring code: a 2HG "player" is one seat with
 * one record, which is exactly what an Entrant already is.
 */

export type TournamentMode = 'solo' | 'two-headed-giant'

/** Best-of-three (draft/sealed default) or best-of-one (what 2HG plays). */
export type MatchFormat = 'bo3' | 'bo1'

export interface Entrant {
  id: string
  /** One name for solo, two for Two-Headed Giant. */
  members: string[]
  /** 1-based draft seat, which round 1's pairings are derived from. */
  seat: number
  /** The last round they played. `null` means still in. A dropped entrant stops being
   * paired but keeps counting in everyone else's tiebreakers, because those matches
   * really were played. */
  droppedAfterRound: number | null
}

/** Games won by each side, plus games that ended in a draw. A bye is stored as 2-0,
 * matching the MTR's "considered to have won the match 2-0". */
export interface MatchResult {
  aGameWins: number
  bGameWins: number
  gameDraws: number
}

export interface Match {
  id: string
  aEntrantId: string
  /** `null` is a bye: entrant A had no opponent this round. */
  bEntrantId: string | null
  /** `null` until someone reports it. Unreported matches count toward nobody's record. */
  result: MatchResult | null
}

export interface Round {
  number: number
  matches: Match[]
}

export interface Tournament {
  mode: TournamentMode
  format: MatchFormat
  totalRounds: number
  entrants: Entrant[]
  rounds: Round[]
}

/** A single row of the standings table. Everything here is derived from `Tournament`
 * on demand and never stored, so correcting an old result updates it automatically. */
export interface Standing {
  rank: number
  entrantId: string
  matchPoints: number
  wins: number
  losses: number
  draws: number
  matchWinPercentage: number
  opponentsMatchWinPercentage: number
  gameWinPercentage: number
  opponentsGameWinPercentage: number
}

/** Injectable `Math.random` so every shuffle and pairing is deterministic in tests. */
export type Rng = () => number

export function entrantName(entrant: Entrant): string {
  return entrant.members.join(' & ')
}
