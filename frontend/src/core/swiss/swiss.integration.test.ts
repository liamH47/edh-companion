import { describe, expect, it } from 'vitest'
import { entrantLabel, mulberry32, playRound } from './fixtures'
import { checkAllInvariants } from './invariants'
import { computeStandings } from './scoring'
import {
  createTournament,
  dropEntrant,
  isRoundComplete,
  isTournamentComplete,
  recommendedRounds,
  repairRoundsFrom,
  reportResult,
  startNextRound,
  swapPairing,
  type FirstRoundPairingMethod,
} from './tournament'
import type { Match, MatchFormat, MatchResult, Rng, Tournament, TournamentMode } from './types'

/**
 * Whole tournaments, start to finish, checked against invariants after every
 * transition.
 *
 * The existing unit specs cover each function in isolation and never chain more than
 * two rounds -- so nothing exercised the loop that actually matters: report results,
 * pair the next round *from those results*, report again. Rounds 3+ are the first time
 * the standings-derived ordering does any real work, and they were untested.
 *
 * Everything here is seeded. A failure prints the seed and player count, which is a
 * complete repro -- no flaky-test triage.
 */

const SCORELINES: Record<MatchFormat, MatchResult[]> = {
  bo3: [
    { aGameWins: 2, bGameWins: 0, gameDraws: 0 },
    { aGameWins: 2, bGameWins: 1, gameDraws: 0 },
    { aGameWins: 1, bGameWins: 1, gameDraws: 1 },
    { aGameWins: 1, bGameWins: 2, gameDraws: 0 },
    { aGameWins: 0, bGameWins: 2, gameDraws: 0 },
  ],
  bo1: [
    { aGameWins: 1, bGameWins: 0, gameDraws: 0 },
    { aGameWins: 0, bGameWins: 0, gameDraws: 1 },
    { aGameWins: 0, bGameWins: 1, gameDraws: 0 },
  ],
}

type Decider = (match: Match) => MatchResult

/** Every scoreline the format allows, including draws -- the existing specs are almost
 * entirely 2-0, which never exercises the draw paths in scoring or the pairer. */
function seededDecider(rng: Rng, format: MatchFormat): Decider {
  const options = SCORELINES[format]
  return () => options[Math.floor(rng() * options.length)]
}

const alwaysAWins: Decider = () => ({ aGameWins: 2, bGameWins: 0, gameDraws: 0 })

interface RunOptions {
  entrantCount: number
  totalRounds: number
  rng: Rng
  decide: Decider
  format?: MatchFormat
  mode?: TournamentMode
  firstRound?: FirstRoundPairingMethod
}

interface RunResult {
  tournament: Tournament
  /** True if any round had to repeat a pairing, after which rematches are expected. */
  everRepeated: boolean
}

function newTournament(options: RunOptions): Tournament {
  return createTournament({
    mode: options.mode ?? 'solo',
    format: options.format ?? 'bo3',
    totalRounds: options.totalRounds,
    entrantMembers: Array.from({ length: options.entrantCount }, (_u, i) => [entrantLabel(i)]),
  })
}

/**
 * Runs a whole event, asserting invariants after each pairing and again after each
 * round's results land. `context` is prefixed to any failure so a sweep failure names
 * the exact configuration.
 */
function runEvent(options: RunOptions, context: string): RunResult {
  let tournament = newTournament(options)
  let everRepeated = false

  for (let roundNumber = 1; roundNumber <= options.totalRounds; roundNumber++) {
    const before = structuredClone(tournament)
    const outcome = startNextRound(tournament, options.rng, options.firstRound)
    expect(tournament, `${context}: startNextRound mutated its input`).toEqual(before)

    tournament = outcome.tournament
    everRepeated = everRepeated || outcome.hadToRepeatPairing

    expect(
      checkAllInvariants(tournament, { allowRematches: everRepeated }),
      `${context}: after pairing R${roundNumber}`,
    ).toEqual([])

    tournament = playRound(tournament, roundNumber, options.decide)

    expect(
      checkAllInvariants(tournament, { allowRematches: everRepeated }),
      `${context}: after reporting R${roundNumber}`,
    ).toEqual([])
    expect(isRoundComplete(tournament, roundNumber), `${context}: R${roundNumber} incomplete`).toBe(
      true,
    )
  }

  return { tournament, everRepeated }
}

describe('full events, swept across field sizes and seeds', () => {
  // 2..16 covers both parities, the single-pod sizes people actually run, and enough
  // rounds at the small end to exhaust rematch-free pairings entirely.
  const entrantCounts = Array.from({ length: 15 }, (_unused, index) => index + 2)
  const formats: MatchFormat[] = ['bo3', 'bo1']
  const seeds = [1, 7, 42, 1337, 90210]

  for (const entrantCount of entrantCounts) {
    it(`holds every invariant for ${entrantCount} entrants across formats and seeds`, () => {
      for (const format of formats) {
        for (const seed of seeds) {
          const context = `n=${entrantCount} ${format} seed=${seed}`
          const rng = mulberry32(seed)
          const totalRounds = recommendedRounds(entrantCount)

          const { tournament } = runEvent(
            { entrantCount, totalRounds, rng, decide: seededDecider(rng, format), format },
            context,
          )

          expect(isTournamentComplete(tournament), `${context}: not complete`).toBe(true)
          expect(tournament.rounds, `${context}: wrong round count`).toHaveLength(totalRounds)
        }
      }
    })
  }

  it('pairs 8 players rematch-free for a full 7 rounds, then repeats on the 8th', () => {
    // 8 players have exactly 7 possible opponents each, so round 8 is the first round
    // that *must* repeat a pairing. Pins both halves: the pairer should not repeat
    // early, and should not fail when repeating is genuinely unavoidable.
    const rng = mulberry32(2026)
    let tournament = newTournament({ entrantCount: 8, totalRounds: 8, rng, decide: alwaysAWins })

    const repeatedAt: number[] = []
    for (let roundNumber = 1; roundNumber <= 8; roundNumber++) {
      const outcome = startNextRound(tournament, rng)
      tournament = outcome.tournament
      if (outcome.hadToRepeatPairing) repeatedAt.push(roundNumber)
      tournament = playRound(tournament, roundNumber, alwaysAWins)
    }

    expect(repeatedAt).toEqual([8])
  })

  it('only reports a repeat in an odd field once no bye choice can avoid one', () => {
    // Three players exhaust their pairings in three rounds (A-B, A-C, B-C), each with
    // one bye. From round 4 on, whoever takes the bye leaves two who have already
    // met -- so a repeat is genuinely forced, and reporting one earlier would mean
    // the pairer gave up on a bye choice that would have worked.
    const rng = mulberry32(17)
    let tournament = newTournament({ entrantCount: 3, totalRounds: 4, rng, decide: alwaysAWins })

    const repeatedAt: number[] = []
    for (let roundNumber = 1; roundNumber <= 4; roundNumber++) {
      const outcome = startNextRound(tournament, rng)
      tournament = outcome.tournament
      if (outcome.hadToRepeatPairing) repeatedAt.push(roundNumber)
      tournament = playRound(tournament, roundNumber, alwaysAWins)
    }

    expect(repeatedAt).toEqual([4])
  })

  it('gives the same tournament for the same seed', () => {
    const run = () =>
      runEvent(
        {
          entrantCount: 7,
          totalRounds: 3,
          rng: mulberry32(99),
          decide: seededDecider(mulberry32(99), 'bo3'),
        },
        'determinism',
      ).tournament

    expect(run()).toEqual(run())
  })

  it('keeps every entrant playing exactly once per round in an odd field', () => {
    // The bye is the only way an odd field balances, so this is really a bye test.
    const rng = mulberry32(5)
    const { tournament } = runEvent(
      { entrantCount: 9, totalRounds: 4, rng, decide: seededDecider(rng, 'bo3') },
      'odd field',
    )

    for (const round of tournament.rounds) {
      const byes = round.matches.filter((match) => match.bEntrantId === null)
      expect(byes).toHaveLength(1)
      expect(byes[0].result).not.toBeNull()
    }
  })
})

describe('drops mid-event', () => {
  it('stops pairing a dropped entrant but keeps their results in tiebreakers', () => {
    const rng = mulberry32(11)
    let tournament = newTournament({ entrantCount: 8, totalRounds: 4, rng, decide: alwaysAWins })

    tournament = startNextRound(tournament, rng).tournament
    tournament = playRound(tournament, 1, alwaysAWins)

    // Drop after round 1: out from round 2 onward, but round 1 still counts.
    const dropped = tournament.entrants[3].id
    tournament = dropEntrant(tournament, dropped, 1)

    for (let roundNumber = 2; roundNumber <= 4; roundNumber++) {
      tournament = startNextRound(tournament, rng).tournament
      tournament = playRound(tournament, roundNumber, alwaysAWins)
    }

    expect(checkAllInvariants(tournament, { allowRematches: true })).toEqual([])

    // Dropping flips the field from 8 to 7, so later rounds need a bye.
    for (const round of tournament.rounds.slice(1)) {
      const ids = round.matches.flatMap((m) => [m.aEntrantId, m.bEntrantId])
      expect(ids).not.toContain(dropped)
      expect(round.matches.filter((m) => m.bEntrantId === null)).toHaveLength(1)
    }

    // Still ranked, because the games they played still happened.
    expect(computeStandings(tournament).map((s) => s.entrantId)).toContain(dropped)
  })
})

describe('re-pairing after a corrected result', () => {
  it('rebuilds every later round and keeps invariants', () => {
    const rng = mulberry32(31)
    let tournament = newTournament({ entrantCount: 8, totalRounds: 3, rng, decide: alwaysAWins })

    for (let roundNumber = 1; roundNumber <= 3; roundNumber++) {
      tournament = startNextRound(tournament, rng).tournament
      tournament = playRound(tournament, roundNumber, alwaysAWins)
    }

    // Correct round 1, then re-pair everything after it.
    const firstMatch = tournament.rounds[0].matches[0]
    tournament = reportResult(tournament, 1, firstMatch.id, {
      aGameWins: 0,
      bGameWins: 2,
      gameDraws: 0,
    })
    const outcome = repairRoundsFrom(tournament, 1, rng)
    tournament = outcome.tournament

    expect(tournament.rounds).toHaveLength(3)
    expect(checkAllInvariants(tournament, { allowRematches: outcome.hadToRepeatPairing })).toEqual(
      [],
    )
    // Rebuilt rounds come back unreported.
    expect(isRoundComplete(tournament, 2)).toBe(false)
  })
})

describe('Two-Headed Giant', () => {
  it('runs a full team event and forces best-of-one', () => {
    const rng = mulberry32(64)
    const tournament = createTournament({
      mode: 'two-headed-giant',
      format: 'bo3',
      totalRounds: 3,
      entrantMembers: [
        ['Ava', 'Ben'],
        ['Cara', 'Dan'],
        ['Eve', 'Finn'],
        ['Gus', 'Hana'],
      ],
    })
    expect(tournament.format).toBe('bo1')

    let current = tournament
    for (let roundNumber = 1; roundNumber <= 3; roundNumber++) {
      current = startNextRound(current, rng).tournament
      current = playRound(current, roundNumber, seededDecider(rng, 'bo1'))
    }

    expect(checkAllInvariants(current, { allowRematches: true })).toEqual([])
    expect(isTournamentComplete(current)).toBe(true)
  })
})

describe('swapping entrants between pairings', () => {
  function twoRoundEvent(entrantCount: number): Tournament {
    const rng = mulberry32(3)
    let tournament = newTournament({ entrantCount, totalRounds: 3, rng, decide: alwaysAWins })
    tournament = startNextRound(tournament, rng).tournament
    return tournament
  }

  it('keeps match ids consistent with who is actually playing', () => {
    const tournament = twoRoundEvent(8)
    const [first, second] = tournament.rounds[0].matches

    const swapped = swapPairing(tournament, 1, first.aEntrantId, second.aEntrantId)

    expect(checkAllInvariants(swapped)).toEqual([])
  })

  it('leaves a swapped-into bye reportable, so the round can still finish', () => {
    // An odd field has a bye. Swapping someone into it must leave it in the
    // already-reported state a bye is created in -- the UI disables reporting for a
    // bye, so an unreported one can never be completed and the round deadlocks.
    const tournament = twoRoundEvent(7)
    const bye = tournament.rounds[0].matches.find((match) => match.bEntrantId === null)!
    const opponent = tournament.rounds[0].matches.find((match) => match.bEntrantId !== null)!

    const swapped = swapPairing(tournament, 1, bye.aEntrantId, opponent.aEntrantId)

    const newBye = swapped.rounds[0].matches.find((match) => match.bEntrantId === null)!
    expect(newBye.result, 'a bye must arrive already reported').not.toBeNull()

    // Report everything a player can actually report, then the round must be complete.
    const played = playRound(swapped, 1, alwaysAWins)
    expect(isRoundComplete(played, 1), 'round deadlocked after swapping into the bye').toBe(true)
  })
})
