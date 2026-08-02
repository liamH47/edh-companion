import { describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, pod, podResult, result, round } from './fixtures'
import {
  computeStandings,
  gameWinPercentage,
  matchPointsFor,
  matchRecord,
  matchWinPercentage,
  MINIMUM_WIN_PERCENTAGE,
  opponentIdsFor,
  opponentsGameWinPercentage,
  opponentsMatchWinPercentage,
} from './scoring'
import type { MatchResult } from './types'

const THIRD = MINIMUM_WIN_PERCENTAGE

describe('matchRecord', () => {
  it('is empty before anything is reported', () => {
    const tournament = makeTournament({ entrants: makeEntrants(2) })
    expect(matchRecord('entrant-1', tournament)).toEqual({ wins: 0, losses: 0, draws: 0 })
  })

  it('ignores a match nobody has reported yet', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
    })
    expect(matchRecord('entrant-1', tournament)).toEqual({ wins: 0, losses: 0, draws: 0 })
  })

  it('counts a 2-0 as a win for A and a loss for B', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(matchRecord('entrant-1', tournament)).toEqual({ wins: 1, losses: 0, draws: 0 })
    expect(matchRecord('entrant-2', tournament)).toEqual({ wins: 0, losses: 1, draws: 0 })
  })

  it('counts an even game split as a draw for both', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(1, 1, 1))])],
    })
    expect(matchRecord('entrant-1', tournament).draws).toBe(1)
    expect(matchRecord('entrant-2', tournament).draws).toBe(1)
  })

  it('counts a bye as a win', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(1),
      rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
    })
    expect(matchRecord('entrant-1', tournament)).toEqual({ wins: 1, losses: 0, draws: 0 })
  })
})

describe('matchPointsFor', () => {
  it('awards 3 for a win, 1 for a draw and 0 for a loss', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(3),
      rounds: [
        round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
        round(2, [match('entrant-1', 'entrant-3', result(1, 1, 1))]),
      ],
    })
    expect(matchPointsFor('entrant-1', tournament)).toBe(4)
    expect(matchPointsFor('entrant-2', tournament)).toBe(0)
    expect(matchPointsFor('entrant-3', tournament)).toBe(1)
  })

  it('awards a bye the same 3 points as a played win', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(1),
      rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
    })
    expect(matchPointsFor('entrant-1', tournament)).toBe(3)
  })
})

describe('matchWinPercentage', () => {
  it('is the floor for an entrant who has played nothing', () => {
    const tournament = makeTournament({ entrants: makeEntrants(1) })
    expect(matchWinPercentage('entrant-1', tournament)).toBe(THIRD)
  })

  it('is 1 for an unbeaten entrant', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(matchWinPercentage('entrant-1', tournament)).toBe(1)
  })

  it('floors a winless entrant at a third rather than reporting zero', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(matchWinPercentage('entrant-2', tournament)).toBe(THIRD)
  })

  it('is match points over three times the rounds played', () => {
    // 1 win + 1 draw over 3 rounds = 4 points of a possible 9.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
        round(2, [match('entrant-1', 'entrant-3', result(1, 1, 1))]),
        round(3, [match('entrant-1', 'entrant-4', result(0, 2))]),
      ],
    })
    expect(matchWinPercentage('entrant-1', tournament)).toBeCloseTo(4 / 9, 10)
  })
})

describe('gameWinPercentage', () => {
  it('counts a 2-1 win as 6 game points from 9 possible', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 1))])],
    })
    expect(gameWinPercentage('entrant-1', tournament)).toBeCloseTo(6 / 9, 10)
  })

  it('counts a drawn game as one game point', () => {
    // 1 win + 1 draw + 1 loss = 3 + 1 = 4 points over 3 games.
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(1, 1, 1))])],
    })
    expect(gameWinPercentage('entrant-1', tournament)).toBeCloseTo(4 / 9, 10)
  })

  it('treats a bye as 6 game points over 2 games, a perfect score', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(1),
      rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
    })
    expect(gameWinPercentage('entrant-1', tournament)).toBe(1)
  })

  it('is the floor before any games are played', () => {
    const tournament = makeTournament({ entrants: makeEntrants(1) })
    expect(gameWinPercentage('entrant-1', tournament)).toBe(THIRD)
  })
})

describe('opponentIdsFor', () => {
  it('lists everyone actually faced', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(3),
      rounds: [
        round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
        round(2, [match('entrant-3', 'entrant-1', result(0, 2))]),
      ],
    })
    expect(opponentIdsFor('entrant-1', tournament).sort()).toEqual(['entrant-2', 'entrant-3'])
  })

  it('excludes a bye, which has no opponent to average', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [
        round(1, [match('entrant-1', null, result(2, 0))]),
        round(2, [match('entrant-1', 'entrant-2', result(2, 0))]),
      ],
    })
    expect(opponentIdsFor('entrant-1', tournament)).toEqual(['entrant-2'])
  })
})

describe('opponentsMatchWinPercentage', () => {
  it('is the floor for an entrant with no opponents yet', () => {
    const tournament = makeTournament({ entrants: makeEntrants(1) })
    expect(opponentsMatchWinPercentage('entrant-1', tournament)).toBe(THIRD)
  })

  it('averages the opponents already-floored percentages', () => {
    // entrant-1 beat 2 and 3. Opponent 2 went 0-2 (floored to 1/3); opponent 3 went
    // 1-1, so 3 points of 6 = 0.5. Average = (1/3 + 0.5) / 2.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
        round(2, [
          match('entrant-1', 'entrant-3', result(2, 0)),
          match('entrant-2', 'entrant-4', result(0, 2)),
        ]),
      ],
    })
    expect(opponentsMatchWinPercentage('entrant-1', tournament)).toBeCloseTo((THIRD + 0.5) / 2, 10)
  })

  it('ignores the bye round when averaging', () => {
    // entrant-1 byed round 1 then beat entrant-2, so the only opponent is entrant-2
    // -- the phantom bye "opponent" must not drag the average toward the floor.
    const tournament = makeTournament({
      entrants: makeEntrants(3),
      rounds: [
        round(1, [match('entrant-1', null, result(2, 0)), match('entrant-2', 'entrant-3', result(2, 0))]),
        round(2, [match('entrant-1', 'entrant-2', result(2, 0))]),
      ],
    })
    // entrant-2 is 1-1 => 3 of 6 => 0.5, and that is the whole average.
    expect(opponentsMatchWinPercentage('entrant-1', tournament)).toBeCloseTo(0.5, 10)
  })
})

describe('opponentsGameWinPercentage', () => {
  it('is the floor with no opponents', () => {
    const tournament = makeTournament({ entrants: makeEntrants(1) })
    expect(opponentsGameWinPercentage('entrant-1', tournament)).toBe(THIRD)
  })

  it('averages opponents game-win percentages', () => {
    // entrant-1 beat entrant-2 2-1: entrant-2 has 3 game points of 9 = 1/3 exactly.
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 1))])],
    })
    expect(opponentsGameWinPercentage('entrant-1', tournament)).toBeCloseTo(THIRD, 10)
  })
})

describe('computeStandings', () => {
  it('ranks by match points first', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(0, 2))])],
    })
    const standings = computeStandings(tournament)
    expect(standings.map((s) => s.entrantId)).toEqual(['entrant-2', 'entrant-1'])
    expect(standings[0].rank).toBe(1)
  })

  it('breaks a match-point tie on opponents match-win percentage', () => {
    // 1 and 3 both go 1-0. Entrant 1 beat entrant 2, who then beat entrant 4 (so a
    // 1-1 opponent); entrant 3 beat entrant 4, who is 0-2. The stronger opponent wins
    // the tie, so entrant 1 outranks entrant 3 despite identical records.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
        round(2, [match('entrant-2', 'entrant-4', result(2, 0))]),
      ],
    })
    const order = computeStandings(tournament).map((s) => s.entrantId)
    expect(order.indexOf('entrant-1')).toBeLessThan(order.indexOf('entrant-3'))
  })

  it('breaks an opponents-percentage tie on the entrants own game-win percentage', () => {
    // Mirror-image bracket: both winners face equally-weak opponents, so OMW% ties and
    // the 2-0 win outranks the 2-1 win.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 1)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const standings = computeStandings(tournament)
    expect(standings[0].entrantId).toBe('entrant-3')
  })

  it('falls back to seat order so identical entrants rank deterministically', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    expect(computeStandings(tournament).map((s) => s.entrantId)).toEqual([
      'entrant-1',
      'entrant-2',
      'entrant-3',
    ])
  })

  it('produces one row per entrant with sequential ranks', () => {
    const tournament = makeTournament({ entrants: makeEntrants(5) })
    const standings = computeStandings(tournament)
    expect(standings).toHaveLength(5)
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps a dropped entrants results in everyone elses tiebreakers', () => {
    // entrant-2 drops after round 1 but still beat entrant-3, so entrant-3's OMW%
    // must reflect having faced a 1-0 player, not a phantom.
    const tournament = makeTournament({
      entrants: makeEntrants(3).map((entrant) =>
        entrant.id === 'entrant-2' ? { ...entrant, droppedAfterRound: 1 } : entrant,
      ),
      rounds: [round(1, [match('entrant-2', 'entrant-3', result(2, 0))])],
    })
    expect(opponentsMatchWinPercentage('entrant-3', tournament)).toBe(1)
    expect(computeStandings(tournament)).toHaveLength(3)
  })
})

describe('a full hand-checked 4-player, 2-round tournament', () => {
  // R1: 1 beats 2 (2-0), 3 beats 4 (2-1). R2: 1 beats 3 (2-1), 2 beats 4 (2-0).
  // Match points: 1 -> 6, 3 -> 3, 2 -> 3, 4 -> 0.
  // entrant-2's opponents are 1 (2-0 => MW% 1) and 4 (0-2 => floored 1/3): avg 2/3.
  // entrant-3's opponents are 4 (floored 1/3) and 1 (MW% 1): avg 2/3 -- an exact tie,
  // which then falls to game-win percentage: entrant-2 has 2+0 of 3+2 games...
  const tournament = makeTournament({
    entrants: makeEntrants(4),
    rounds: [
      round(1, [
        match('entrant-1', 'entrant-2', result(2, 0)),
        match('entrant-3', 'entrant-4', result(2, 1)),
      ]),
      round(2, [
        match('entrant-1', 'entrant-3', result(2, 1)),
        match('entrant-2', 'entrant-4', result(2, 0)),
      ]),
    ],
  })

  it('puts the undefeated entrant first on match points alone', () => {
    const standings = computeStandings(tournament)
    expect(standings[0].entrantId).toBe('entrant-1')
    expect(standings[0].matchPoints).toBe(6)
    expect(standings[0].wins).toBe(2)
  })

  it('puts the winless entrant last', () => {
    const standings = computeStandings(tournament)
    expect(standings[3].entrantId).toBe('entrant-4')
    expect(standings[3].matchPoints).toBe(0)
    expect(standings[3].losses).toBe(2)
  })

  it('gives both 3-point entrants the same opponents match-win percentage', () => {
    expect(opponentsMatchWinPercentage('entrant-2', tournament)).toBeCloseTo(2 / 3, 10)
    expect(opponentsMatchWinPercentage('entrant-3', tournament)).toBeCloseTo(2 / 3, 10)
  })

  it('separates them on game-win percentage', () => {
    // entrant-2: lost 0-2 then won 2-0 => 6 points of 12. entrant-3: won 2-1 then lost
    // 1-2 => 9 points of 18, the same 0.5 -- so they stay tied and seat order decides.
    expect(gameWinPercentage('entrant-2', tournament)).toBeCloseTo(0.5, 10)
    expect(gameWinPercentage('entrant-3', tournament)).toBeCloseTo(0.5, 10)
    const order = computeStandings(tournament).map((s) => s.entrantId)
    expect(order.indexOf('entrant-2')).toBeLessThan(order.indexOf('entrant-3'))
  })
})

describe('scoring a multiplayer pod', () => {
  /**
   * No pod *pairing* exists yet, so these hand-build the matches. That is the point:
   * they prove the scoring model already generalises past two players, which is the
   * whole reason for holding participants in a list. If these pass, pod pairing only
   * has to produce the right groupings -- it does not need its own scoring path.
   */
  const FOUR = ['entrant-1', 'entrant-2', 'entrant-3', 'entrant-4']

  function podTournament(matchResult: MatchResult) {
    return makeTournament({
      entrants: makeEntrants(4),
      rounds: [round(1, [pod(FOUR, matchResult)])],
    })
  }

  it('gives the winner 3 points and everyone else 0', () => {
    const t = podTournament(podResult(4, 1))

    expect(matchPointsFor('entrant-2', t)).toBe(3)
    for (const loser of ['entrant-1', 'entrant-3', 'entrant-4']) {
      expect(matchPointsFor(loser, t)).toBe(0)
    }
  })

  it('records one win and three losses, not one win and one loss', () => {
    const t = podTournament(podResult(4, 1))

    expect(matchRecord('entrant-2', t)).toEqual({ wins: 1, losses: 0, draws: 0 })
    expect(matchRecord('entrant-1', t)).toEqual({ wins: 0, losses: 1, draws: 0 })
  })

  it('gives everyone 1 point when the pod is drawn', () => {
    const t = podTournament(podResult(4, null))

    for (const id of FOUR) {
      expect(matchPointsFor(id, t)).toBe(1)
      expect(matchRecord(id, t)).toEqual({ wins: 0, losses: 0, draws: 1 })
    }
  })

  it('counts every other player in the pod as an opponent', () => {
    // Beating three people should count three opponents toward OMW%, not one.
    const t = podTournament(podResult(4, 0))

    expect(opponentIdsFor('entrant-1', t).sort()).toEqual([
      'entrant-2',
      'entrant-3',
      'entrant-4',
    ])
  })

  it('treats the pod as a single game for game-win percentage', () => {
    const t = podTournament(podResult(4, 0))

    // One game, won by entrant-1: 3 of 3 game points.
    expect(gameWinPercentage('entrant-1', t)).toBe(1)
    // Losers earn nothing and fall to the one-third floor.
    expect(gameWinPercentage('entrant-2', t)).toBe(MINIMUM_WIN_PERCENTAGE)
  })

  it('ranks the pod winner first', () => {
    const standings = computeStandings(podTournament(podResult(4, 2)))

    expect(standings[0].entrantId).toBe('entrant-3')
    expect(standings[0].matchPoints).toBe(3)
  })

  it('scores a three-player pod the same way', () => {
    // The rule is "sole highest game wins takes it", not "one of exactly four".
    const t = makeTournament({
      entrants: makeEntrants(3),
      rounds: [round(1, [pod(['entrant-1', 'entrant-2', 'entrant-3'], podResult(3, 2))])],
    })

    expect(matchPointsFor('entrant-3', t)).toBe(3)
    expect(matchPointsFor('entrant-1', t)).toBe(0)
    expect(opponentIdsFor('entrant-3', t)).toHaveLength(2)
  })
})
