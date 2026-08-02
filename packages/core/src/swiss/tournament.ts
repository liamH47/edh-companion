import {
  makeBye,
  makeMatch,
  podPairings,
  randomFirstRoundPairings,
  randomPods,
  seatPairings,
  seatPods,
  shuffle,
  swissPairings,
} from './pairing'
import type {
  EventFormat,
  MatchFormat,
  MatchResult,
  Rng,
  Tournament,
  TournamentMode,
} from './types'

/**
 * Every transition returns a new Tournament rather than mutating one, so React state
 * updates are trivial and a caller can hold on to a previous state (which is what
 * makes "keep pairings or re-pair?" implementable as two pure branches).
 *
 * Standings are never stored -- see scoring.computeStandings -- so correcting an old
 * result is just reportResult; nothing else needs invalidating.
 */

export const DEFAULT_ROUNDS = 3
export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 8

/** How many Swiss rounds comfortably separate a field of this size. Mirrors MTR
 * Appendix E from 9 players up; below that the MTR suggests single elimination, but
 * 3 rounds of Swiss is what a draft pod actually plays, so that's the default. */
export function recommendedRounds(entrantCount: number): number {
  if (entrantCount <= 8) return 3
  if (entrantCount <= 16) return 4
  if (entrantCount <= 32) return 5
  if (entrantCount <= 64) return 6
  return 7
}

export interface CreateTournamentInput {
  mode: TournamentMode
  eventFormat: EventFormat
  format: MatchFormat
  totalRounds: number
  /** In seat order. One name per entrant for solo, two for Two-Headed Giant. */
  entrantMembers: string[][]
}

export function createTournament(input: CreateTournamentInput): Tournament {
  return {
    mode: input.mode,
    eventFormat: input.eventFormat,
    // Two-Headed Giant and Commander are both played as a single game, so the
    // best-of-three choice doesn't apply to either.
    format:
      input.mode === 'two-headed-giant' || input.eventFormat === 'commander'
        ? 'bo1'
        : input.format,
    totalRounds: input.totalRounds,
    entrants: input.entrantMembers.map((members, index) => ({
      id: `entrant-${index + 1}`,
      members,
      seat: index + 1,
      droppedAfterRound: null,
    })),
    rounds: [],
  }
}

/** Reassigns seats at random, keeping entrant identity. For players who didn't draft
 * in a fixed order and just want the app to decide. */
export function assignSeatsRandomly(tournament: Tournament, rng: Rng): Tournament {
  const shuffled = shuffle(tournament.entrants, rng)
  const seatByEntrantId = new Map(shuffled.map((entrant, index) => [entrant.id, index + 1]))
  return {
    ...tournament,
    entrants: tournament.entrants.map((entrant) => ({
      ...entrant,
      seat: seatByEntrantId.get(entrant.id)!,
    })),
  }
}

/** Moves one entrant up or down a seat, for entering the order you actually drafted
 * in. A no-op at the ends rather than wrapping around. */
export function moveEntrantSeat(
  tournament: Tournament,
  entrantId: string,
  direction: -1 | 1,
): Tournament {
  const bySeat = [...tournament.entrants].sort((a, b) => a.seat - b.seat)
  const index = bySeat.findIndex((entrant) => entrant.id === entrantId)
  const target = index + direction
  if (index === -1 || target < 0 || target >= bySeat.length) return tournament

  const reordered = [...bySeat]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  const seatByEntrantId = new Map(reordered.map((entrant, i) => [entrant.id, i + 1]))
  return {
    ...tournament,
    entrants: tournament.entrants.map((entrant) => ({
      ...entrant,
      seat: seatByEntrantId.get(entrant.id)!,
    })),
  }
}

export type FirstRoundPairingMethod = 'draft-seating' | 'random'

export interface StartRoundOutcome {
  tournament: Tournament
  hadToRepeatPairing: boolean
}

/**
 * Generates the next round. Round 1 comes from draft seating (or at random, for a
 * Sealed event with no seating to speak of); later rounds come from the Swiss pairer.
 */
export function startNextRound(
  tournament: Tournament,
  rng: Rng,
  firstRoundMethod: FirstRoundPairingMethod = 'draft-seating',
): StartRoundOutcome {
  const roundNumber = tournament.rounds.length + 1
  const isPodded = tournament.eventFormat === 'commander'

  if (roundNumber === 1) {
    const random = firstRoundMethod === 'random'
    const matches = isPodded
      ? random
        ? randomPods(tournament.entrants, rng)
        : seatPods(tournament.entrants)
      : random
        ? randomFirstRoundPairings(tournament.entrants, rng)
        : seatPairings(tournament.entrants)
    return {
      tournament: { ...tournament, rounds: [{ number: 1, matches }] },
      hadToRepeatPairing: false,
    }
  }

  const { matches, hadToRepeatPairing } = isPodded
    ? podPairings(tournament, roundNumber, rng)
    : swissPairings(tournament, roundNumber, rng)
  return {
    tournament: { ...tournament, rounds: [...tournament.rounds, { number: roundNumber, matches }] },
    hadToRepeatPairing,
  }
}

/** Records (or corrects) one match's result. Standings recompute from this alone. */
export function reportResult(
  tournament: Tournament,
  roundNumber: number,
  matchId: string,
  result: MatchResult | null,
): Tournament {
  return {
    ...tournament,
    rounds: tournament.rounds.map((round) =>
      round.number !== roundNumber
        ? round
        : {
            ...round,
            matches: round.matches.map((match) =>
              match.id === matchId ? { ...match, result } : match,
            ),
          },
    ),
  }
}

/**
 * Discards every round after `roundNumber` and regenerates them from the corrected
 * results. The opt-in half of editing a past result: standings always update, but
 * re-pairing rounds people may already be playing is the user's call.
 */
export function repairRoundsFrom(
  tournament: Tournament,
  roundNumber: number,
  rng: Rng,
): StartRoundOutcome {
  const roundsToRebuild = tournament.rounds.length - roundNumber
  let rebuilt: Tournament = {
    ...tournament,
    rounds: tournament.rounds.slice(0, roundNumber),
  }

  let hadToRepeatPairing = false
  for (let i = 0; i < roundsToRebuild; i++) {
    const outcome = startNextRound(rebuilt, rng)
    rebuilt = outcome.tournament
    hadToRepeatPairing = hadToRepeatPairing || outcome.hadToRepeatPairing
  }
  return { tournament: rebuilt, hadToRepeatPairing }
}

/** Marks an entrant as out from the next round onward. They keep counting in
 * everyone else's tiebreakers, because the matches they played really happened. */
export function dropEntrant(
  tournament: Tournament,
  entrantId: string,
  afterRound: number,
): Tournament {
  return {
    ...tournament,
    entrants: tournament.entrants.map((entrant) =>
      entrant.id === entrantId ? { ...entrant, droppedAfterRound: afterRound } : entrant,
    ),
  }
}

export function reinstateEntrant(tournament: Tournament, entrantId: string): Tournament {
  return {
    ...tournament,
    entrants: tournament.entrants.map((entrant) =>
      entrant.id === entrantId ? { ...entrant, droppedAfterRound: null } : entrant,
    ),
  }
}

/**
 * Manual override: swaps two entrants between their matches in a round, for when the
 * generated pairing needs a human correction. Both must be playing in that round, and
 * swapping someone with their own opponent is rejected rather than producing a match
 * against themselves.
 */
export function swapPairing(
  tournament: Tournament,
  roundNumber: number,
  entrantAId: string,
  entrantBId: string,
): Tournament {
  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)
  if (!round || entrantAId === entrantBId) return tournament

  const matchOf = (id: string) => round.matches.find((match) => match.entrantIds.includes(id))
  const matchA = matchOf(entrantAId)
  const matchB = matchOf(entrantBId)
  if (!matchA || !matchB || matchA.id === matchB.id) return tournament

  const substitute = (id: string) =>
    id === entrantAId ? entrantBId : id === entrantBId ? entrantAId : id

  return {
    ...tournament,
    rounds: tournament.rounds.map((candidate) =>
      candidate.number !== roundNumber
        ? candidate
        : {
            ...candidate,
            matches: candidate.matches.map((match) => {
              if (match.id !== matchA.id && match.id !== matchB.id) return match
              const swapped = match.entrantIds.map(substitute)
              // Rebuilt through the pairing constructors rather than spread, for two
              // reasons. The id is derived from the participants, so spreading keeps
              // one that names the players who *used* to be here -- and every result
              // lookup is keyed on it. And a bye has to come back already reported:
              // the UI offers no way to report one, so an unreported bye can never be
              // completed and the round can never advance.
              //
              // For a real match the result is still dropped, because it belongs to
              // the pairing rather than the players -- it no longer describes who
              // played whom.
              return swapped.length === 1 ? makeBye(swapped[0]) : makeMatch(swapped)
            }),
          },
    ),
  }
}

export function isTournamentComplete(tournament: Tournament): boolean {
  return (
    tournament.rounds.length >= tournament.totalRounds &&
    tournament.rounds.every((round) => round.matches.every((match) => match.result !== null))
  )
}

export function isRoundComplete(tournament: Tournament, roundNumber: number): boolean {
  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)
  return round !== undefined && round.matches.every((match) => match.result !== null)
}

/** Entrant ids paired in a round, used by the UI to offer swap targets. */
export function entrantIdsInRound(tournament: Tournament, roundNumber: number): string[] {
  const round = tournament.rounds.find((candidate) => candidate.number === roundNumber)
  if (!round) return []
  return round.matches.flatMap((match) => match.entrantIds)
}
