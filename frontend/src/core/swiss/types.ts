/**
 * Domain model for a Swiss tournament. Pure data -- no React, no DOM, no storage --
 * so the pairing and scoring modules beside it port to React Native untouched.
 *
 * Two-Headed Giant is modeled by giving an Entrant two `members` rather than by
 * branching anywhere in the pairing or scoring code: a 2HG "player" is one seat with
 * one record, which is exactly what an Entrant already is.
 */

export type TournamentMode = 'solo' | 'two-headed-giant'

/**
 * What is being played. This affects exactly one thing in pairing -- how round 1 is
 * seeded -- plus whether the field is split into pods at all:
 *
 * - `draft`       round 1 from draft seating, so the players furthest apart meet first
 * - `sealed`      no meaningful seating; round 1 is random
 * - `constructed` likewise random
 * - `commander`   multiplayer pods rather than 1v1, every round
 *
 * Nothing else branches on it. Scoring, tiebreakers and drops are identical throughout.
 */
export type EventFormat = 'draft' | 'sealed' | 'constructed' | 'commander'

/** Best-of-three (draft/sealed default) or best-of-one (what 2HG and Commander play). */
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

/**
 * Games won by each entrant, positionally aligned with the match's `entrantIds`, plus
 * games that ended in a draw.
 *
 * Deliberately a list rather than an A-side/B-side pair: a Commander pod has three or
 * more players and no "sides". The win/loss/draw a player actually gets is derived
 * from it rather than stored, by one rule that covers every shape -- sole highest
 * game wins is a win, tied at the highest is a draw, anything else is a loss:
 *
 *   [2, 0]        1v1, 2-0            -> win, loss
 *   [1, 1]        1v1 drawn match     -> draw, draw
 *   [2]           a bye               -> win (MTR: "considered to have won 2-0")
 *   [0, 1, 0, 0]  a pod B won         -> loss, win, loss, loss
 *   [0, 0, 0]     a pod that timed out -> draw, draw, draw
 */
export interface MatchResult {
  gameWins: number[]
  gameDraws: number
}

export interface Match {
  id: string
  /**
   * Everyone playing, in pairing order. One entrant is a bye, two is an ordinary
   * 1v1 match, three or more is a Commander pod. Keeping a single shape means
   * pairing, scoring and the invariant checks have one code path rather than one per
   * table size.
   */
  entrantIds: string[]
  /** `null` until someone reports it. Unreported matches count toward nobody's record. */
  result: MatchResult | null
}

/** A bye is the degenerate match: one entrant, nobody to play. */
export function isBye(match: Match): boolean {
  return match.entrantIds.length === 1
}

/** Everyone in the match except the given entrant. Empty for a bye, which is exactly
 * why byes contribute no opponent to OMW%/OGW%. */
export function opponentsIn(match: Match, entrantId: string): string[] {
  return match.entrantIds.filter((id) => id !== entrantId)
}

export interface Round {
  number: number
  matches: Match[]
}

export interface Tournament {
  mode: TournamentMode
  eventFormat: EventFormat
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
