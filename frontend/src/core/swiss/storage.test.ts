import { afterEach, describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from './fixtures'
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
