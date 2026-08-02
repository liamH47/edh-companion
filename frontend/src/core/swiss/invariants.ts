import { computeStandings, MINIMUM_WIN_PERCENTAGE } from './scoring'
import type { Match, Standing, Tournament } from './types'

/**
 * Properties that must hold of *any* tournament, whatever the entrant count, round
 * count or result pattern. The integration sweep asserts these after every transition;
 * a single hand-written test can only ever check the case its author thought of.
 *
 * Every checker returns a list of violation descriptions rather than throwing. Two
 * reasons: a failing sweep reports everything wrong at once instead of the first
 * thing, and -- more importantly -- a checker that returns data can be unit-tested
 * against a deliberately-broken tournament. A checker only ever fed valid input
 * returns "no violations" for the wrong reason and is worse than no checker at all.
 */

/** Byes are recorded as a 2-0 the moment they're created (pairing.makeBye). */
const BYE_GAME_WINS = 2

function nameOf(match: Match): string {
  return `${match.aEntrantId} vs ${match.bEntrantId ?? 'bye'}`
}

/**
 * Match ids are documented as derived from their participants, and every result
 * lookup is keyed on (round, matchId) -- so an id that disagrees with the entrants it
 * points at silently reports results against the wrong pairing.
 */
export function checkMatchIdsMatchParticipants(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter(
        (match) => match.id !== `${match.aEntrantId}-vs-${match.bEntrantId ?? 'bye'}`,
      )
      .map(
        (match) =>
          `R${round.number}: match id "${match.id}" does not match its participants (${nameOf(match)})`,
      ),
  )
}

/** Everyone still in plays exactly once a round; everyone who dropped plays not at all. */
export function checkRoundCoverage(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) => {
    const appearances = new Map<string, number>()
    for (const match of round.matches) {
      for (const id of [match.aEntrantId, match.bEntrantId]) {
        if (id !== null) appearances.set(id, (appearances.get(id) ?? 0) + 1)
      }
    }

    return tournament.entrants.flatMap((entrant) => {
      const active =
        entrant.droppedAfterRound === null || entrant.droppedAfterRound >= round.number
      const expected = active ? 1 : 0
      const actual = appearances.get(entrant.id) ?? 0
      return actual === expected
        ? []
        : [
            `R${round.number}: ${entrant.id} appears ${actual} time(s), expected ${expected}` +
              (active ? '' : ' (dropped)'),
          ]
    })
  })
}

/**
 * At most one bye per round, nobody gets a second while anyone else still lacks one,
 * and every bye is pre-reported as a win -- an unreported bye can never be reported
 * through the UI, so it would deadlock the round forever.
 */
export function checkByes(tournament: Tournament): string[] {
  const violations: string[] = []
  const byeCountById = new Map<string, number>()

  for (const round of tournament.rounds) {
    const byes = round.matches.filter((match) => match.bEntrantId === null)
    if (byes.length > 1) {
      violations.push(`R${round.number}: ${byes.length} byes in one round`)
    }
    for (const bye of byes) {
      byeCountById.set(bye.aEntrantId, (byeCountById.get(bye.aEntrantId) ?? 0) + 1)
      if (bye.result === null) {
        violations.push(`R${round.number}: bye for ${bye.aEntrantId} has no result`)
      } else if (bye.result.aGameWins !== BYE_GAME_WINS || bye.result.bGameWins !== 0) {
        violations.push(
          `R${round.number}: bye for ${bye.aEntrantId} is not a ${BYE_GAME_WINS}-0`,
        )
      }
    }
  }

  // A second bye is only legitimate once everyone still in has had one.
  const repeatByes = [...byeCountById.entries()].filter(([, count]) => count > 1)
  const everyoneHasHadOne = tournament.entrants.every(
    (entrant) => (byeCountById.get(entrant.id) ?? 0) > 0,
  )
  if (repeatByes.length > 0 && !everyoneHasHadOne) {
    violations.push(
      `${repeatByes.map(([id]) => id).join(', ')} had a second bye while others had none`,
    )
  }
  return violations
}

/**
 * No pair meets twice. Only meaningful when the pairer reported it did not have to
 * repeat one -- once `hadToRepeatPairing` is true, a rematch is the correct outcome.
 */
export function checkNoRematches(tournament: Tournament): string[] {
  const seen = new Set<string>()
  const violations: string[] = []

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.bEntrantId === null) continue
      const key = [match.aEntrantId, match.bEntrantId].sort().join('|')
      if (seen.has(key)) {
        violations.push(`R${round.number}: ${nameOf(match)} is a rematch`)
      }
      seen.add(key)
    }
  }
  return violations
}

/**
 * Match points are conserved: every reported match puts exactly 3 into the pool (a
 * win, or a bye), except a draw, which puts 2 in. Catches a scoring change that
 * quietly creates or destroys points.
 */
export function checkMatchPointsConserved(
  tournament: Tournament,
  standings: Standing[],
): string[] {
  let expected = 0
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.result === null) continue
      const { aGameWins, bGameWins } = match.result
      expected += aGameWins === bGameWins ? 2 : 3
    }
  }

  const actual = standings.reduce((total, standing) => total + standing.matchPoints, 0)
  return actual === expected
    ? []
    : [`match points total ${actual}, expected ${expected}`]
}

/**
 * Standings are a well-formed ranking: one row per entrant, ranks 1..N, percentages
 * inside their floored range, ordered by points.
 *
 * Takes the ranking rather than computing it, because every one of these properties
 * is currently guaranteed by construction in `computeStandings` -- so a checker that
 * called it directly could never fail, and a test could never prove it detects
 * anything. Passing the ranking in makes each check answerable against deliberately
 * broken data, which is the only way to know it works before it has to.
 */
export function checkStandingsWellFormed(
  tournament: Tournament,
  standings: Standing[],
): string[] {
  const violations: string[] = []

  if (standings.length !== tournament.entrants.length) {
    violations.push(
      `standings have ${standings.length} rows for ${tournament.entrants.length} entrants`,
    )
  }

  const ranks = standings.map((standing) => standing.rank)
  const expectedRanks = standings.map((_unused, index) => index + 1)
  if (ranks.join(',') !== expectedRanks.join(',')) {
    violations.push(`ranks are ${ranks.join(',')}, expected ${expectedRanks.join(',')}`)
  }

  for (const standing of standings) {
    const percentages = [
      ['MW', standing.matchWinPercentage],
      ['OMW', standing.opponentsMatchWinPercentage],
      ['GW', standing.gameWinPercentage],
      ['OGW', standing.opponentsGameWinPercentage],
    ] as const
    for (const [name, value] of percentages) {
      if (value < MINIMUM_WIN_PERCENTAGE || value > 1) {
        violations.push(`${standing.entrantId}: ${name}% is ${value}, outside [1/3, 1]`)
      }
    }
  }

  // Sorted by match points descending -- the finer tiebreakers are scoring.ts's own
  // business, but a standings table out of points order is unambiguously wrong.
  for (let i = 1; i < standings.length; i++) {
    if (standings[i - 1].matchPoints < standings[i].matchPoints) {
      violations.push(
        `standings out of order: rank ${i} has ${standings[i - 1].matchPoints} points, ` +
          `rank ${i + 1} has ${standings[i].matchPoints}`,
      )
    }
  }
  return violations
}

/** Nobody is paired against themselves. Cheap, and the obvious failure mode of any
 * change to the swap or re-pair logic. */
export function checkNoSelfPairings(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter((match) => match.aEntrantId === match.bEntrantId)
      .map((match) => `R${round.number}: ${match.aEntrantId} is paired against itself`),
  )
}

export interface InvariantOptions {
  /** Rematches are legitimate once the pairer has reported it ran out of options. */
  allowRematches?: boolean
}

/** Every invariant that holds unconditionally, as one list. */
export function checkAllInvariants(
  tournament: Tournament,
  options: InvariantOptions = {},
): string[] {
  const standings = computeStandings(tournament)
  return [
    ...checkMatchIdsMatchParticipants(tournament),
    ...checkRoundCoverage(tournament),
    ...checkByes(tournament),
    ...checkNoSelfPairings(tournament),
    ...checkMatchPointsConserved(tournament, standings),
    ...checkStandingsWellFormed(tournament, standings),
    ...(options.allowRematches === true ? [] : checkNoRematches(tournament)),
  ]
}
