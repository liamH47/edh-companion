import { afterEach, describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from './fixtures'
import { checkAllInvariants } from './invariants'
import { matchPointsFor } from './scoring'
import { clearTournament, loadTournament, saveTournament } from './storage'

afterEach(() => {
  localStorage.clear()
})

describe('tournament storage', () => {
  it('is null before anything is saved', () => {
    expect(loadTournament()).toBeNull()
  })

  it('round-trips a tournament, rounds and results included', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 1))])],
    })
    saveTournament(tournament)
    expect(loadTournament()).toEqual(tournament)
  })

  it('overwrites the previous tournament rather than accumulating', () => {
    saveTournament(makeTournament({ entrants: makeEntrants(2) }))
    saveTournament(makeTournament({ entrants: makeEntrants(4) }))
    expect(loadTournament()!.entrants).toHaveLength(4)
  })

  it('clears back to null', () => {
    saveTournament(makeTournament({ entrants: makeEntrants(2) }))
    clearTournament()
    expect(loadTournament()).toBeNull()
  })

  it('returns null rather than throwing on unparseable stored data', () => {
    localStorage.setItem('mtg-calc-tournament', 'not json')
    expect(loadTournament()).toBeNull()
  })
})

describe('migrating a tournament saved before pods', () => {
  /** Exactly what the old code wrote: a match was two sides, or one plus a bye. */
  function legacyStored(): unknown {
    return {
      mode: 'solo',
      format: 'bo3',
      totalRounds: 3,
      entrants: makeEntrants(3),
      rounds: [
        {
          number: 1,
          matches: [
            {
              id: 'entrant-1-vs-entrant-2',
              aEntrantId: 'entrant-1',
              bEntrantId: 'entrant-2',
              result: { aGameWins: 2, bGameWins: 1, gameDraws: 0 },
            },
            {
              id: 'entrant-3-vs-bye',
              aEntrantId: 'entrant-3',
              bEntrantId: null,
              result: { aGameWins: 2, bGameWins: 0, gameDraws: 0 },
            },
          ],
        },
        {
          number: 2,
          matches: [
            {
              id: 'entrant-1-vs-entrant-3',
              aEntrantId: 'entrant-1',
              bEntrantId: 'entrant-3',
              result: null,
            },
            {
              id: 'entrant-2-vs-bye',
              aEntrantId: 'entrant-2',
              bEntrantId: null,
              result: { aGameWins: 2, bGameWins: 0, gameDraws: 0 },
            },
          ],
        },
      ],
    }
  }

  function loadLegacy() {
    localStorage.setItem('mtg-calc-tournament', JSON.stringify(legacyStored()))
    return loadTournament()!
  }

  it('converts a 1v1 match to a participant list, preserving the scoreline', () => {
    const [played] = loadLegacy().rounds[0].matches
    expect(played.entrantIds).toEqual(['entrant-1', 'entrant-2'])
    expect(played.result).toEqual({ gameWins: [2, 1], gameDraws: 0 })
  })

  it('converts a bye to a single entrant with a single game-win entry', () => {
    // The old shape stored a 0 for an opponent who does not exist; carrying it over
    // would make the bye look like a two-player match to every downstream lookup.
    const bye = loadLegacy().rounds[0].matches[1]
    expect(bye.entrantIds).toEqual(['entrant-3'])
    expect(bye.result).toEqual({ gameWins: [2], gameDraws: 0 })
  })

  it('leaves an unreported match unreported', () => {
    const unreported = loadLegacy().rounds[1].matches[0]
    expect(unreported.entrantIds).toEqual(['entrant-1', 'entrant-3'])
    expect(unreported.result).toBeNull()
  })

  it('keeps ids, entrants and settings untouched', () => {
    const migrated = loadLegacy()
    expect(migrated.rounds.flatMap((r) => r.matches).map((m) => m.id)).toEqual([
      'entrant-1-vs-entrant-2',
      'entrant-3-vs-bye',
      'entrant-1-vs-entrant-3',
      'entrant-2-vs-bye',
    ])
    expect(migrated.entrants).toHaveLength(3)
    expect(migrated.totalRounds).toBe(3)
  })

  it('produces a tournament the rest of the app can score', () => {
    // The migration is only worth anything if the result is a usable tournament, not
    // merely a correctly-shaped one.
    const migrated = loadLegacy()
    expect(checkAllInvariants(migrated)).toEqual([])
    expect(matchPointsFor('entrant-1', migrated)).toBe(3)
    expect(matchPointsFor('entrant-3', migrated)).toBe(3)
    expect(matchPointsFor('entrant-2', migrated)).toBe(3)
  })

  it('leaves an already-migrated tournament alone', () => {
    const current = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    saveTournament(current)
    expect(loadTournament()).toEqual(current)
  })
})
