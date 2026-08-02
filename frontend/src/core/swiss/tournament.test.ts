import { describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round, seededRng } from './fixtures'
import { computeStandings } from './scoring'
import {
  assignSeatsRandomly,
  createTournament,
  dropEntrant,
  entrantIdsInRound,
  isRoundComplete,
  isTournamentComplete,
  moveEntrantSeat,
  recommendedRounds,
  reinstateEntrant,
  reportResult,
  repairRoundsFrom,
  startNextRound,
  swapPairing,
} from './tournament'

function names(count: number): string[][] {
  return Array.from({ length: count }, (_unused, i) => [String.fromCharCode(65 + i)])
}

describe('recommendedRounds', () => {
  it('recommends 3 rounds for a draft pod', () => {
    expect(recommendedRounds(6)).toBe(3)
    expect(recommendedRounds(8)).toBe(3)
  })

  it('scales with the field size', () => {
    expect(recommendedRounds(16)).toBe(4)
    expect(recommendedRounds(32)).toBe(5)
    expect(recommendedRounds(64)).toBe(6)
    expect(recommendedRounds(200)).toBe(7)
  })
})

describe('createTournament', () => {
  it('seats entrants in the order their names were given', () => {
    const tournament = createTournament({
      mode: 'solo',
      format: 'bo3',
      totalRounds: 3,
      entrantMembers: names(3),
    })
    expect(tournament.entrants.map((e) => [e.seat, e.members[0]])).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
    ])
    expect(tournament.rounds).toEqual([])
  })

  it('forces best-of-one for Two-Headed Giant regardless of the format asked for', () => {
    const tournament = createTournament({
      mode: 'two-headed-giant',
      format: 'bo3',
      totalRounds: 3,
      entrantMembers: [['A', 'B'], ['C', 'D']],
    })
    expect(tournament.format).toBe('bo1')
  })

  it('keeps both member names on a Two-Headed Giant team', () => {
    const tournament = createTournament({
      mode: 'two-headed-giant',
      format: 'bo1',
      totalRounds: 3,
      entrantMembers: [['A', 'B'], ['C', 'D']],
    })
    expect(tournament.entrants[0].members).toEqual(['A', 'B'])
  })

  it('honours the chosen format for a solo event', () => {
    const tournament = createTournament({
      mode: 'solo',
      format: 'bo1',
      totalRounds: 3,
      entrantMembers: names(2),
    })
    expect(tournament.format).toBe('bo1')
  })
})

describe('assignSeatsRandomly', () => {
  it('gives every entrant a distinct seat from 1..N', () => {
    const tournament = makeTournament({ entrants: makeEntrants(6) })
    const seated = assignSeatsRandomly(tournament, seededRng([0.3, 0.8, 0.1, 0.6, 0.4]))
    expect([...seated.entrants.map((e) => e.seat)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('keeps the same entrants, only their seats change', () => {
    const tournament = makeTournament({ entrants: makeEntrants(4) })
    const seated = assignSeatsRandomly(tournament, seededRng([0.9, 0.2, 0.5]))
    expect(seated.entrants.map((e) => e.id).sort()).toEqual(
      tournament.entrants.map((e) => e.id).sort(),
    )
  })
})

describe('moveEntrantSeat', () => {
  it('swaps an entrant with the one above it', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    const moved = moveEntrantSeat(tournament, 'entrant-2', -1)
    const seats = Object.fromEntries(moved.entrants.map((e) => [e.id, e.seat]))
    expect(seats).toEqual({ 'entrant-1': 2, 'entrant-2': 1, 'entrant-3': 3 })
  })

  it('swaps an entrant with the one below it', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    const moved = moveEntrantSeat(tournament, 'entrant-2', 1)
    const seats = Object.fromEntries(moved.entrants.map((e) => [e.id, e.seat]))
    expect(seats).toEqual({ 'entrant-1': 1, 'entrant-2': 3, 'entrant-3': 2 })
  })

  it('is a no-op at the top', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    expect(moveEntrantSeat(tournament, 'entrant-1', -1)).toBe(tournament)
  })

  it('is a no-op at the bottom', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    expect(moveEntrantSeat(tournament, 'entrant-3', 1)).toBe(tournament)
  })

  it('is a no-op for an unknown entrant', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    expect(moveEntrantSeat(tournament, 'nobody', 1)).toBe(tournament)
  })
})

describe('startNextRound', () => {
  it('builds round 1 from draft seating by default', () => {
    const tournament = makeTournament({ entrants: makeEntrants(4) })
    const { tournament: next } = startNextRound(tournament, seededRng())
    expect(next.rounds).toHaveLength(1)
    expect(next.rounds[0].number).toBe(1)
    // 4-pod: 1v3 and 2v4.
    const pairs = next.rounds[0].matches.map((m) => `${m.aEntrantId}|${m.bEntrantId}`)
    expect(pairs).toEqual(['entrant-1|entrant-3', 'entrant-2|entrant-4'])
  })

  it('builds round 1 at random when asked, for a sealed event', () => {
    const tournament = makeTournament({ entrants: makeEntrants(4) })
    const { tournament: next } = startNextRound(tournament, seededRng([0.9, 0.1, 0.5]), 'random')
    expect(next.rounds[0].matches).toHaveLength(2)
  })

  it('uses Swiss pairings from round 2 onward', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const { tournament: next } = startNextRound(tournament, seededRng([0.5]))
    expect(next.rounds).toHaveLength(2)
    expect(next.rounds[1].number).toBe(2)
    const pairs = next.rounds[1].matches.map((m) =>
      [m.aEntrantId, m.bEntrantId].sort().join('|'),
    )
    expect(pairs.sort()).toEqual(['entrant-1|entrant-3', 'entrant-2|entrant-4'])
  })

  it('does not mutate the tournament it was given', () => {
    const tournament = makeTournament({ entrants: makeEntrants(4) })
    startNextRound(tournament, seededRng())
    expect(tournament.rounds).toEqual([])
  })
})

describe('reportResult', () => {
  const base = makeTournament({
    entrants: makeEntrants(2),
    rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
  })

  it('records a result on the named match', () => {
    const next = reportResult(base, 1, 'entrant-1-vs-entrant-2', result(2, 1))
    expect(next.rounds[0].matches[0].result).toEqual({ aGameWins: 2, bGameWins: 1, gameDraws: 0 })
  })

  it('immediately changes the standings, with nothing else to invalidate', () => {
    const next = reportResult(base, 1, 'entrant-1-vs-entrant-2', result(2, 0))
    expect(computeStandings(next)[0].entrantId).toBe('entrant-1')

    // Correcting the same match flips the standings with no other call needed.
    const corrected = reportResult(next, 1, 'entrant-1-vs-entrant-2', result(0, 2))
    expect(computeStandings(corrected)[0].entrantId).toBe('entrant-2')
  })

  it('can clear a result back to unreported', () => {
    const reported = reportResult(base, 1, 'entrant-1-vs-entrant-2', result(2, 0))
    expect(reportResult(reported, 1, 'entrant-1-vs-entrant-2', null).rounds[0].matches[0].result)
      .toBeNull()
  })

  it('leaves other rounds untouched', () => {
    const twoRounds = makeTournament({
      entrants: makeEntrants(2),
      rounds: [
        round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
        round(2, [match('entrant-2', 'entrant-1', null)]),
      ],
    })
    const next = reportResult(twoRounds, 2, 'entrant-2-vs-entrant-1', result(2, 0))
    expect(next.rounds[0].matches[0].result).toEqual({ aGameWins: 2, bGameWins: 0, gameDraws: 0 })
  })

  it('ignores an unknown match id', () => {
    const next = reportResult(base, 1, 'no-such-match', result(2, 0))
    expect(next.rounds[0].matches[0].result).toBeNull()
  })
})

describe('repairRoundsFrom', () => {
  it('regenerates later rounds from corrected results', () => {
    // Round 1 was entered backwards; round 2 was paired from the wrong standings.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(0, 2)),
          match('entrant-3', 'entrant-4', result(0, 2)),
        ]),
        round(2, [
          match('entrant-2', 'entrant-4', null),
          match('entrant-1', 'entrant-3', null),
        ]),
      ],
    })
    const { tournament: repaired } = repairRoundsFrom(tournament, 1, seededRng([0.5]))
    expect(repaired.rounds).toHaveLength(2)
    // Winners (2 and 4) still face each other; the point is the round was rebuilt.
    expect(repaired.rounds[0].matches[0].result).toEqual({
      aGameWins: 0,
      bGameWins: 2,
      gameDraws: 0,
    })
  })

  it('keeps rounds up to and including the given one', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
        round(2, [match('entrant-1', 'entrant-3', result(2, 0))]),
      ],
    })
    const { tournament: repaired } = repairRoundsFrom(tournament, 1, seededRng([0.5]))
    expect(repaired.rounds[0]).toEqual(tournament.rounds[0])
    expect(repaired.rounds).toHaveLength(2)
  })

  it('is a no-op on the last round, which has nothing after it to rebuild', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    const { tournament: repaired } = repairRoundsFrom(tournament, 1, seededRng([0.5]))
    expect(repaired.rounds).toEqual(tournament.rounds)
  })
})

describe('dropEntrant / reinstateEntrant', () => {
  it('marks an entrant as out after the given round', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    const next = dropEntrant(tournament, 'entrant-2', 1)
    expect(next.entrants.find((e) => e.id === 'entrant-2')!.droppedAfterRound).toBe(1)
  })

  it('leaves other entrants alone', () => {
    const tournament = makeTournament({ entrants: makeEntrants(3) })
    const next = dropEntrant(tournament, 'entrant-2', 1)
    expect(next.entrants.find((e) => e.id === 'entrant-1')!.droppedAfterRound).toBeNull()
  })

  it('can put a dropped entrant back in', () => {
    const tournament = dropEntrant(makeTournament({ entrants: makeEntrants(3) }), 'entrant-2', 1)
    const next = reinstateEntrant(tournament, 'entrant-2')
    expect(next.entrants.find((e) => e.id === 'entrant-2')!.droppedAfterRound).toBeNull()
  })

  it('leaves other entrants alone when reinstating', () => {
    const tournament = dropEntrant(makeTournament({ entrants: makeEntrants(2) }), 'entrant-1', 1)
    const next = reinstateEntrant(tournament, 'entrant-1')
    expect(next.entrants.find((e) => e.id === 'entrant-2')!.droppedAfterRound).toBeNull()
  })
})

describe('swapPairing', () => {
  const tournament = makeTournament({
    entrants: makeEntrants(4),
    rounds: [
      round(1, [
        match('entrant-1', 'entrant-2', result(2, 0)),
        match('entrant-3', 'entrant-4', result(2, 0)),
      ]),
    ],
  })

  it('exchanges two entrants between their matches', () => {
    const next = swapPairing(tournament, 1, 'entrant-2', 'entrant-3')
    const pairs = next.rounds[0].matches.map((m) => `${m.aEntrantId}|${m.bEntrantId}`)
    expect(pairs).toEqual(['entrant-1|entrant-3', 'entrant-2|entrant-4'])
  })

  it('clears the results of both affected matches, which no longer describe who played', () => {
    const next = swapPairing(tournament, 1, 'entrant-2', 'entrant-3')
    expect(next.rounds[0].matches.every((m) => m.result === null)).toBe(true)
  })

  it('is a no-op when the two are already facing each other', () => {
    expect(swapPairing(tournament, 1, 'entrant-1', 'entrant-2')).toBe(tournament)
  })

  it('is a no-op for the same entrant twice', () => {
    expect(swapPairing(tournament, 1, 'entrant-1', 'entrant-1')).toBe(tournament)
  })

  it('is a no-op for an entrant not playing in that round', () => {
    expect(swapPairing(tournament, 1, 'entrant-1', 'nobody')).toBe(tournament)
  })

  it('is a no-op for an unknown round', () => {
    expect(swapPairing(tournament, 9, 'entrant-1', 'entrant-3')).toBe(tournament)
  })

  it('can swap an entrant into a bye', () => {
    const withBye = makeTournament({
      entrants: makeEntrants(3),
      rounds: [
        round(1, [match('entrant-1', 'entrant-2', null), match('entrant-3', null, result(2, 0))]),
      ],
    })
    const next = swapPairing(withBye, 1, 'entrant-2', 'entrant-3')
    const pairs = next.rounds[0].matches.map((m) => `${m.aEntrantId}|${m.bEntrantId ?? 'bye'}`)
    expect(pairs).toEqual(['entrant-1|entrant-3', 'entrant-2|bye'])
  })

  it('leaves other rounds entirely untouched', () => {
    const twoRounds = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
        round(2, [
          match('entrant-1', 'entrant-3', result(2, 0)),
          match('entrant-2', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const next = swapPairing(twoRounds, 2, 'entrant-3', 'entrant-4')
    expect(next.rounds[0]).toEqual(twoRounds.rounds[0])
    expect(next.rounds[1].matches.map((m) => `${m.aEntrantId}|${m.bEntrantId}`)).toEqual([
      'entrant-1|entrant-4',
      'entrant-2|entrant-3',
    ])
  })

  it('leaves matches involving neither entrant untouched', () => {
    const sixPlayer = makeTournament({
      entrants: makeEntrants(6),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
          match('entrant-5', 'entrant-6', result(2, 0)),
        ]),
      ],
    })
    const next = swapPairing(sixPlayer, 1, 'entrant-1', 'entrant-3')
    expect(next.rounds[0].matches[2]).toEqual(sixPlayer.rounds[0].matches[2])
  })
})

describe('isRoundComplete / isTournamentComplete', () => {
  it('a round is incomplete while any match is unreported', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', null),
        ]),
      ],
    })
    expect(isRoundComplete(tournament, 1)).toBe(false)
  })

  it('a round is complete once every match is reported', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(isRoundComplete(tournament, 1)).toBe(true)
  })

  it('an unknown round is not complete', () => {
    expect(isRoundComplete(makeTournament(), 1)).toBe(false)
  })

  it('a tournament is incomplete while rounds remain to be played', () => {
    const tournament = makeTournament({
      totalRounds: 3,
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(isTournamentComplete(tournament)).toBe(false)
  })

  it('a tournament is complete once every round is played and reported', () => {
    const tournament = makeTournament({
      totalRounds: 1,
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    expect(isTournamentComplete(tournament)).toBe(true)
  })

  it('a tournament with its last round unreported is incomplete', () => {
    const tournament = makeTournament({
      totalRounds: 1,
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
    })
    expect(isTournamentComplete(tournament)).toBe(false)
  })
})

describe('entrantIdsInRound', () => {
  it('lists both sides of every match', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', null),
          match('entrant-3', 'entrant-4', null),
        ]),
      ],
    })
    expect(entrantIdsInRound(tournament, 1).sort()).toEqual([
      'entrant-1',
      'entrant-2',
      'entrant-3',
      'entrant-4',
    ])
  })

  it('lists the single entrant of a bye', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(1),
      rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
    })
    expect(entrantIdsInRound(tournament, 1)).toEqual(['entrant-1'])
  })

  it('is empty for an unknown round', () => {
    expect(entrantIdsInRound(makeTournament(), 3)).toEqual([])
  })
})
