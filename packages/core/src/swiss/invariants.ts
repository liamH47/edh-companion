import { BYE_GAME_WINS, computeStandings, MINIMUM_WIN_PERCENTAGE } from './scoring'
import { isBye, type Match, type Standing, type Tournament } from './types'

/**
 * Properties that must hold of *any* tournament, whatever the entrant count, round
 * count, table size or result pattern. The integration sweep asserts these after every
 * transition; a single hand-written test can only ever check the case its author
 * thought of.
 *
 * Every checker returns a list of violation descriptions rather than throwing. Two
 * reasons: a failing sweep reports everything wrong at once instead of the first
 * thing, and -- more importantly -- a checker that returns data can be unit-tested
 * against a deliberately-broken tournament. A checker only ever fed valid input
 * returns "no violations" for the wrong reason and is worse than no checker at all.
 */

function nameOf(match: Match): string {
  return isBye(match) ? `${match.entrantIds[0]} vs bye` : match.entrantIds.join(' vs ')
}

/** The same derivation pairing.ts uses, duplicated deliberately: a checker that called
 * the production helper could not detect the production helper being wrong. */
function expectedIdFor(match: Match): string {
  return isBye(match) ? `${match.entrantIds[0]}-vs-bye` : match.entrantIds.join('-vs-')
}

/** Every unordered pair of entrants sharing a table. One pair for a 1v1, six for a
 * four-player pod, none for a bye. */
function pairsIn(match: Match): string[] {
  const pairs: string[] = []
  for (let i = 0; i < match.entrantIds.length; i++) {
    for (let j = i + 1; j < match.entrantIds.length; j++) {
      pairs.push([match.entrantIds[i], match.entrantIds[j]].sort().join('|'))
    }
  }
  return pairs
}

/**
 * Match ids are documented as derived from their participants, and every result
 * lookup is keyed on (round, matchId) -- so an id that disagrees with the entrants it
 * points at silently reports results against the wrong pairing.
 */
export function checkMatchIdsMatchParticipants(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter((match) => match.id !== expectedIdFor(match))
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
      for (const id of match.entrantIds) {
        appearances.set(id, (appearances.get(id) ?? 0) + 1)
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
    const byes = round.matches.filter(isBye)
    if (byes.length > 1) {
      violations.push(`R${round.number}: ${byes.length} byes in one round`)
    }
    for (const bye of byes) {
      const id = bye.entrantIds[0]
      byeCountById.set(id, (byeCountById.get(id) ?? 0) + 1)
      if (bye.result === null) {
        violations.push(`R${round.number}: bye for ${id} has no result`)
      } else if (bye.result.gameWins[0] !== BYE_GAME_WINS) {
        violations.push(`R${round.number}: bye for ${id} is not a ${BYE_GAME_WINS}-0`)
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
 * No two entrants share a table twice. Only meaningful when the pairer reported it did
 * not have to repeat a pairing -- once `hadToRepeatPairing` is true, a rematch is the
 * correct outcome.
 */
export function checkNoRematches(tournament: Tournament): string[] {
  const seen = new Set<string>()
  const violations: string[] = []

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      for (const pair of pairsIn(match)) {
        if (seen.has(pair)) {
          violations.push(`R${round.number}: ${pair.replace('|', ' vs ')} have already met`)
        }
        seen.add(pair)
      }
    }
  }
  return violations
}

/**
 * Match points are conserved. Every reported match puts 3 into the pool when one
 * entrant took it outright, or 1 per entrant tied at the top when it was drawn.
 * Catches a scoring change that quietly creates or destroys points.
 */
export function checkMatchPointsConserved(
  tournament: Tournament,
  standings: Standing[],
): string[] {
  let expected = 0
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.result === null) continue
      const { gameWins } = match.result
      const best = Math.max(...gameWins)
      const atBest = gameWins.filter((wins) => wins === best).length
      expected += atBest === 1 ? 3 : atBest
    }
  }

  const actual = standings.reduce((total, standing) => total + standing.matchPoints, 0)
  return actual === expected ? [] : [`match points total ${actual}, expected ${expected}`]
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

/** Nobody appears twice at the same table. Cheap, and the obvious failure mode of any
 * change to the swap or re-pair logic. */
export function checkNoSelfPairings(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter((match) => new Set(match.entrantIds).size !== match.entrantIds.length)
      .map((match) => `R${round.number}: ${nameOf(match)} contains the same entrant twice`),
  )
}

/**
 * A result carries exactly one game-win count per entrant.
 *
 * New with the N-participant model, and worth having: every per-entrant lookup indexes
 * `gameWins` by the entrant's position, so a short array reads `undefined` and poisons
 * every percentage downstream instead of failing anywhere near the cause.
 */
export function checkResultsMatchParticipants(tournament: Tournament): string[] {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter(
        (match) =>
          match.result !== null && match.result.gameWins.length !== match.entrantIds.length,
      )
      .map(
        (match) =>
          `R${round.number}: ${nameOf(match)} has ${match.result!.gameWins.length} game-win ` +
          `entries for ${match.entrantIds.length} entrant(s)`,
      ),
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
    ...checkResultsMatchParticipants(tournament),
    ...checkMatchPointsConserved(tournament, standings),
    ...checkStandingsWellFormed(tournament, standings),
    ...(options.allowRematches === true ? [] : checkNoRematches(tournament)),
  ]
}
