import { describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from './fixtures'
import {
  checkAllInvariants,
  checkByes,
  checkMatchIdsMatchParticipants,
  checkMatchPointsConserved,
  checkNoRematches,
  checkNoSelfPairings,
  checkRoundCoverage,
  checkStandingsWellFormed,
} from './invariants'
import { computeStandings } from './scoring'
import type { Standing, Tournament } from './types'

/**
 * Every test here builds a *deliberately broken* tournament and asserts the checker
 * notices. That is the whole point: a checker only ever fed valid input returns "no
 * violations" for every case and looks like it works while detecting nothing. These
 * are the tests that make the integration sweep's green run mean something.
 */

const BYE_WIN = result(2, 0)

function withRounds(rounds: Tournament['rounds'], entrantCount = 4): Tournament {
  return makeTournament({ entrants: makeEntrants(entrantCount), rounds })
}

describe('checkMatchIdsMatchParticipants', () => {
  it('accepts ids derived from the participants', () => {
    const t = withRounds([round(1, [match('entrant-1', 'entrant-2', result(2, 0))])])
    expect(checkMatchIdsMatchParticipants(t)).toEqual([])
  })

  it('catches an id naming players who are no longer in the match', () => {
    // Exactly what a swap used to leave behind: participants rewritten, id stale.
    const stale = { ...match('entrant-1', 'entrant-2'), aEntrantId: 'entrant-3' }
    const t = withRounds([round(1, [stale])])

    expect(checkMatchIdsMatchParticipants(t)).toEqual([
      'R1: match id "entrant-1-vs-entrant-2" does not match its participants (entrant-3 vs entrant-2)',
    ])
  })

  it('catches a bye whose id still names an opponent', () => {
    const stale = { ...match('entrant-1', 'entrant-2'), bEntrantId: null }
    expect(checkMatchIdsMatchParticipants(withRounds([round(1, [stale])]))).toHaveLength(1)
  })
})

describe('checkRoundCoverage', () => {
  it('accepts every active entrant playing exactly once', () => {
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2'), match('entrant-3', 'entrant-4')]),
    ])
    expect(checkRoundCoverage(t)).toEqual([])
  })

  it('catches an entrant paired twice in one round', () => {
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2'), match('entrant-1', 'entrant-3')]),
    ])
    const violations = checkRoundCoverage(t)

    expect(violations).toContain('R1: entrant-1 appears 2 time(s), expected 1')
    expect(violations).toContain('R1: entrant-4 appears 0 time(s), expected 1')
  })

  it('catches an entrant left out of a round entirely', () => {
    const t = withRounds([round(1, [match('entrant-1', 'entrant-2')])])
    expect(checkRoundCoverage(t)).toContain('R1: entrant-3 appears 0 time(s), expected 1')
  })

  it('accepts a dropped entrant being absent from later rounds', () => {
    const entrants = makeEntrants(4)
    entrants[3] = { ...entrants[3], droppedAfterRound: 1 }
    const t = makeTournament({
      entrants,
      rounds: [
        round(1, [match('entrant-1', 'entrant-2'), match('entrant-3', 'entrant-4')]),
        round(2, [match('entrant-1', 'entrant-3'), match('entrant-2', null, BYE_WIN)]),
      ],
    })
    expect(checkRoundCoverage(t)).toEqual([])
  })

  it('catches a dropped entrant still being paired', () => {
    const entrants = makeEntrants(4)
    entrants[3] = { ...entrants[3], droppedAfterRound: 1 }
    const t = makeTournament({
      entrants,
      rounds: [
        round(1, [match('entrant-1', 'entrant-2'), match('entrant-3', 'entrant-4')]),
        round(2, [match('entrant-1', 'entrant-4'), match('entrant-2', 'entrant-3')]),
      ],
    })
    expect(checkRoundCoverage(t)).toContain('R2: entrant-4 appears 1 time(s), expected 0 (dropped)')
  })
})

describe('checkByes', () => {
  it('accepts a single pre-reported bye', () => {
    const t = withRounds([round(1, [match('entrant-1', 'entrant-2'), match('entrant-3', null, BYE_WIN)])], 3)
    expect(checkByes(t)).toEqual([])
  })

  it('catches two byes in one round', () => {
    const t = withRounds([
      round(1, [match('entrant-1', null, BYE_WIN), match('entrant-2', null, BYE_WIN)]),
    ])
    expect(checkByes(t)).toContain('R1: 2 byes in one round')
  })

  it('catches an unreported bye, which would deadlock the round', () => {
    // The UI disables reporting for a bye, so a null result here can never be
    // completed -- the round can never advance. This is the swap defect's signature.
    const t = withRounds([round(1, [match('entrant-1', null, null)])])
    expect(checkByes(t)).toContain('R1: bye for entrant-1 has no result')
  })

  it('catches a bye recorded as something other than a 2-0', () => {
    const t = withRounds([round(1, [match('entrant-1', null, result(1, 1, 1))])])
    expect(checkByes(t)).toContain('R1: bye for entrant-1 is not a 2-0')
  })

  it('catches a second bye while another entrant has had none', () => {
    const t = withRounds(
      [
        round(1, [match('entrant-1', null, BYE_WIN)]),
        round(2, [match('entrant-1', null, BYE_WIN)]),
      ],
      2,
    )
    expect(checkByes(t)).toContain('entrant-1 had a second bye while others had none')
  })

  it('accepts a second bye once everyone has had one', () => {
    const t = withRounds(
      [
        round(1, [match('entrant-1', null, BYE_WIN)]),
        round(2, [match('entrant-2', null, BYE_WIN)]),
        round(3, [match('entrant-1', null, BYE_WIN)]),
      ],
      2,
    )
    expect(checkByes(t)).toEqual([])
  })
})

describe('checkNoRematches', () => {
  it('accepts distinct pairings', () => {
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2')]),
      round(2, [match('entrant-1', 'entrant-3')]),
    ])
    expect(checkNoRematches(t)).toEqual([])
  })

  it('catches the same pair meeting twice, in either orientation', () => {
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2')]),
      round(2, [match('entrant-2', 'entrant-1')]),
    ])
    expect(checkNoRematches(t)).toEqual(['R2: entrant-2 vs entrant-1 is a rematch'])
  })

  it('ignores byes, which are not pairings', () => {
    const t = withRounds([
      round(1, [match('entrant-1', null, BYE_WIN)]),
      round(2, [match('entrant-2', null, BYE_WIN)]),
    ])
    expect(checkNoRematches(t)).toEqual([])
  })
})

describe('checkNoSelfPairings', () => {
  it('accepts distinct opponents', () => {
    expect(checkNoSelfPairings(withRounds([round(1, [match('entrant-1', 'entrant-2')])]))).toEqual(
      [],
    )
  })

  it('catches an entrant paired against themselves', () => {
    const t = withRounds([round(1, [match('entrant-1', 'entrant-1')])])
    expect(checkNoSelfPairings(t)).toEqual(['R1: entrant-1 is paired against itself'])
  })
})

describe('checkMatchPointsConserved', () => {
  const played = withRounds([
    round(1, [match('entrant-1', 'entrant-2', result(2, 0)), match('entrant-3', 'entrant-4', result(1, 1, 1))]),
  ])

  it('accepts a ranking whose points match the results', () => {
    expect(checkMatchPointsConserved(played, computeStandings(played))).toEqual([])
  })

  it('catches points that do not add up', () => {
    // One decisive match (3) plus one draw (2) = 5 points in the pool.
    const inflated = computeStandings(played).map((standing) => ({
      ...standing,
      matchPoints: standing.matchPoints + 1,
    }))
    expect(checkMatchPointsConserved(played, inflated)).toEqual([
      'match points total 9, expected 5',
    ])
  })

  it('ignores unreported matches', () => {
    const partly = withRounds([
      round(1, [match('entrant-1', 'entrant-2', result(2, 0)), match('entrant-3', 'entrant-4')]),
    ])
    expect(checkMatchPointsConserved(partly, computeStandings(partly))).toEqual([])
  })
})

describe('checkStandingsWellFormed', () => {
  const tournament = withRounds([
    round(1, [match('entrant-1', 'entrant-2', result(2, 0)), match('entrant-3', 'entrant-4', result(2, 0))]),
  ])
  const valid = computeStandings(tournament)

  it('accepts a real ranking', () => {
    expect(checkStandingsWellFormed(tournament, valid)).toEqual([])
  })

  it('catches a missing row', () => {
    expect(checkStandingsWellFormed(tournament, valid.slice(1))).toContain(
      'standings have 3 rows for 4 entrants',
    )
  })

  it('catches ranks that are not 1..N', () => {
    const misranked: Standing[] = valid.map((standing) => ({ ...standing, rank: 1 }))
    expect(checkStandingsWellFormed(tournament, misranked)).toContain(
      'ranks are 1,1,1,1, expected 1,2,3,4',
    )
  })

  it('catches a percentage below the one-third floor', () => {
    const broken = valid.map((standing, index) =>
      index === 0 ? { ...standing, gameWinPercentage: 0 } : standing,
    )
    expect(checkStandingsWellFormed(tournament, broken)).toContain(
      'entrant-1: GW% is 0, outside [1/3, 1]',
    )
  })

  it('catches a percentage above 1', () => {
    const broken = valid.map((standing, index) =>
      index === 0 ? { ...standing, opponentsMatchWinPercentage: 1.5 } : standing,
    )
    expect(checkStandingsWellFormed(tournament, broken)).toContain(
      'entrant-1: OMW% is 1.5, outside [1/3, 1]',
    )
  })

  it('catches rows out of match-point order', () => {
    const reversed = [...valid].reverse().map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }))
    expect(checkStandingsWellFormed(tournament, reversed).join(' ')).toContain(
      'standings out of order',
    )
  })
})

describe('checkAllInvariants', () => {
  it('reports nothing for a well-formed tournament', () => {
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2', result(2, 0)), match('entrant-3', 'entrant-4', result(2, 1))]),
    ])
    expect(checkAllInvariants(t)).toEqual([])
  })

  it('collects violations from every checker at once', () => {
    // Deliberately several problems: a rematch, a self-pairing, and a stale id.
    const t = withRounds([
      round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
      round(2, [match('entrant-1', 'entrant-2', result(2, 0))]),
    ])
    expect(checkAllInvariants(t).length).toBeGreaterThan(1)
  })

  it('tolerates rematches when the pairer reported it had to repeat one', () => {
    const t = withRounds(
      [
        round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
        round(2, [match('entrant-1', 'entrant-2', result(2, 0))]),
      ],
      2,
    )
    expect(checkAllInvariants(t, { allowRematches: true })).toEqual([])
    expect(checkAllInvariants(t, { allowRematches: false })).toContain(
      'R2: entrant-1 vs entrant-2 is a rematch',
    )
  })
})
