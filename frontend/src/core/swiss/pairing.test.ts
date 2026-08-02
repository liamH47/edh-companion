import { describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round, seededRng } from './fixtures'
import {
  activeEntrantsForRound,
  havePlayed,
  randomFirstRoundPairings,
  seatPairings,
  shuffle,
  swissPairings,
} from './pairing'
import type { Match } from './types'

/** Pairings as unordered "a|b" strings, so assertions don't depend on match order. */
function pairsOf(matches: Match[]): string[] {
  return matches.map((m) => [m.entrantIds[0], m.entrantIds[1] ?? 'bye'].sort().join('|')).sort()
}

function byeIn(matches: Match[]): string | undefined {
  return matches.find((m) => m.entrantIds.length === 1)?.entrantIds[0]
}

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5], seededRng([0.1, 0.9, 0.5, 0.3]))
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate the input', () => {
    const original = [1, 2, 3]
    shuffle(original, seededRng([0.9]))
    expect(original).toEqual([1, 2, 3])
  })

  it('is deterministic for a given rng', () => {
    const a = shuffle([1, 2, 3, 4], seededRng([0.2, 0.7, 0.4]))
    const b = shuffle([1, 2, 3, 4], seededRng([0.2, 0.7, 0.4]))
    expect(a).toEqual(b)
  })

  it('returns a single item unchanged', () => {
    expect(shuffle([1], seededRng())).toEqual([1])
  })
})

describe('seatPairings', () => {
  it('pairs a 6-pod as 1v4, 2v5, 3v6', () => {
    expect(pairsOf(seatPairings(makeEntrants(6)))).toEqual(
      ['entrant-1|entrant-4', 'entrant-2|entrant-5', 'entrant-3|entrant-6'].sort(),
    )
  })

  it('pairs an 8-pod as 1v5, 2v6, 3v7, 4v8', () => {
    expect(pairsOf(seatPairings(makeEntrants(8)))).toEqual(
      [
        'entrant-1|entrant-5',
        'entrant-2|entrant-6',
        'entrant-3|entrant-7',
        'entrant-4|entrant-8',
      ].sort(),
    )
  })

  it('pairs a 4-pod as 1v3, 2v4', () => {
    expect(pairsOf(seatPairings(makeEntrants(4)))).toEqual(
      ['entrant-1|entrant-3', 'entrant-2|entrant-4'].sort(),
    )
  })

  it('byes the last seat in an odd pod and pairs the rest by opposite seats', () => {
    const matches = seatPairings(makeEntrants(7))
    expect(byeIn(matches)).toBe('entrant-7')
    expect(pairsOf(matches.filter((m) => m.entrantIds.length > 1))).toEqual(
      ['entrant-1|entrant-4', 'entrant-2|entrant-5', 'entrant-3|entrant-6'].sort(),
    )
  })

  it('records the bye as a reported 2-0 win needing no user input', () => {
    const bye = seatPairings(makeEntrants(5)).find((m) => m.entrantIds.length === 1)!
    // A bye has one entrant, so one game-win entry -- the old shape's second
    // slot described an opponent who does not exist.
    expect(bye.result).toEqual({ gameWins: [2], gameDraws: 0 })
  })

  it('reads seats rather than array order', () => {
    const reversed = [...makeEntrants(4)].reverse()
    expect(pairsOf(seatPairings(reversed))).toEqual(
      ['entrant-1|entrant-3', 'entrant-2|entrant-4'].sort(),
    )
  })

  it('produces no matches for an empty field', () => {
    expect(seatPairings([])).toEqual([])
  })
})

describe('randomFirstRoundPairings', () => {
  it('pairs everyone exactly once', () => {
    const matches = randomFirstRoundPairings(makeEntrants(6), seededRng([0.3, 0.8, 0.1, 0.6]))
    const paired = matches.flatMap((m) => [m.entrantIds[0], m.entrantIds[1]]).filter(Boolean)
    expect(new Set(paired).size).toBe(6)
    expect(matches).toHaveLength(3)
  })

  it('byes exactly one entrant in an odd field', () => {
    const matches = randomFirstRoundPairings(makeEntrants(5), seededRng([0.4]))
    expect(matches.filter((m) => m.entrantIds.length === 1)).toHaveLength(1)
  })
})

describe('activeEntrantsForRound', () => {
  it('includes everyone when nobody has dropped', () => {
    const tournament = makeTournament({ entrants: makeEntrants(4) })
    expect(activeEntrantsForRound(tournament, 2)).toHaveLength(4)
  })

  it('excludes an entrant from the round after they dropped', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4).map((e) =>
        e.id === 'entrant-2' ? { ...e, droppedAfterRound: 1 } : e,
      ),
    })
    // Still in for the round they played, out for the next.
    expect(activeEntrantsForRound(tournament, 1).map((e) => e.id)).toContain('entrant-2')
    expect(activeEntrantsForRound(tournament, 2).map((e) => e.id)).not.toContain('entrant-2')
  })
})

describe('havePlayed', () => {
  const tournament = makeTournament({
    entrants: makeEntrants(3),
    rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
  })

  it('is true regardless of which side each entrant was on', () => {
    expect(havePlayed('entrant-1', 'entrant-2', tournament)).toBe(true)
    expect(havePlayed('entrant-2', 'entrant-1', tournament)).toBe(true)
  })

  it('is false for a pairing that has not happened', () => {
    expect(havePlayed('entrant-1', 'entrant-3', tournament)).toBe(false)
  })
})

describe('swissPairings', () => {
  it('never repeats a pairing when an alternative exists', () => {
    // 4 entrants, round 1 played. Round 2 must cross the winners and losers.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const { matches, hadToRepeatPairing } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(hadToRepeatPairing).toBe(false)
    expect(pairsOf(matches)).not.toContain('entrant-1|entrant-2')
    expect(pairsOf(matches)).not.toContain('entrant-3|entrant-4')
  })

  it('pairs the two winners together and the two losers together', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const { matches } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(pairsOf(matches)).toEqual(['entrant-1|entrant-3', 'entrant-2|entrant-4'].sort())
  })

  it('reports a forced rematch when the field has no alternative left', () => {
    // Two entrants who have already played can only be paired together again.
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    const { matches, hadToRepeatPairing } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(hadToRepeatPairing).toBe(true)
    expect(pairsOf(matches)).toEqual(['entrant-1|entrant-2'])
  })

  it('gives the bye to the lowest-ranked entrant in an odd field', () => {
    // entrant-3 lost and sits bottom of the standings.
    const tournament = makeTournament({
      entrants: makeEntrants(3),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', null, result(2, 0)),
        ]),
      ],
    })
    // entrant-3 already had the bye, so it must move to whoever is now lowest without one.
    const { matches } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(byeIn(matches)).toBe('entrant-2')
  })

  it('does not give the same entrant a second bye while anyone else lacks one', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(5),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
          match('entrant-5', null, result(2, 0)),
        ]),
      ],
    })
    const { matches } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(byeIn(matches)).not.toBe('entrant-5')
  })

  it('falls back to repeating a bye once everyone has had one', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(1),
      rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
    })
    const { matches } = swissPairings(tournament, 2, seededRng([0.5]))
    expect(byeIn(matches)).toBe('entrant-1')
  })

  it('excludes dropped entrants from the pairing', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(4).map((e) =>
        e.id === 'entrant-4' ? { ...e, droppedAfterRound: 1 } : e,
      ),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(2, 0)),
          match('entrant-3', 'entrant-4', result(2, 0)),
        ]),
      ],
    })
    const { matches } = swissPairings(tournament, 2, seededRng([0.5]))
    const involved = matches.flatMap((m) => [m.entrantIds[0], m.entrantIds[1]])
    expect(involved).not.toContain('entrant-4')
    // Three remain, so one takes the bye.
    expect(byeIn(matches)).toBeDefined()
  })

  it('pairs a full 8-entrant round 2 with no repeats and nobody left out', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(8),
      rounds: [round(1, seatPairings(makeEntrants(8)).map((m) => ({ ...m, result: result(2, 0) })))],
    })
    const { matches, hadToRepeatPairing } = swissPairings(tournament, 2, seededRng([0.2, 0.7, 0.4]))
    expect(hadToRepeatPairing).toBe(false)
    expect(matches).toHaveLength(4)
    const involved = matches.flatMap((m) => [m.entrantIds[0], m.entrantIds[1]!])
    expect(new Set(involved).size).toBe(8)
    for (const m of matches) {
      expect(havePlayed(m.entrantIds[0], m.entrantIds[1]!, tournament)).toBe(false)
    }
  })

  it('produces no matches for an empty field', () => {
    const { matches } = swissPairings(makeTournament(), 2, seededRng())
    expect(matches).toEqual([])
  })

  it('randomises within a score group rather than always producing one fixed pairing', () => {
    // Four entrants who all drew are tied on every tiebreaker, so only the rng can
    // separate them. Exactly two rematch-free pairings exist ({1-3,2-4} and
    // {1-4,2-3}); across many seeds both must show up, or the "randomisation" is
    // really just a fixed function of the results and a small pod would see the same
    // players meet over and over.
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', result(1, 1, 1)),
          match('entrant-3', 'entrant-4', result(1, 1, 1)),
        ]),
      ],
    })

    const seen = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const rng = seededRng([(seed % 10) / 10, ((seed * 7) % 10) / 10, ((seed * 3) % 10) / 10])
      const pairing = pairsOf(swissPairings(tournament, 2, rng).matches)
      expect(pairing).not.toContain('entrant-1|entrant-2')
      expect(pairing).not.toContain('entrant-3|entrant-4')
      seen.add(pairing.join(','))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})
