import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
// `result` is aliased: renderHook destructures its own `result`, and the two collide.
import {
  makeEntrants,
  makeTournament,
  match,
  result as gameResult,
  round,
  seededRng,
} from './fixtures'
import { loadTournament, saveTournament } from './storage'
import { useTournament } from './useTournament'

afterEach(() => {
  localStorage.clear()
})

const NAMES = [['Ava'], ['Ben'], ['Cara'], ['Dev']]

function startInput(overrides = {}) {
  return {
    mode: 'solo' as const,
    eventFormat: 'draft' as const,
    format: 'bo3' as const,
    totalRounds: 3,
    entrantMembers: NAMES,
    ...overrides,
  }
}

describe('useTournament', () => {
  it('starts with no tournament', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    expect(result.current.tournament).toBeNull()
  })

  it('resumes whatever was persisted', () => {
    saveTournament(makeTournament({ entrants: makeEntrants(2) }))
    const { result } = renderHook(() => useTournament(seededRng()))
    expect(result.current.tournament!.entrants).toHaveLength(2)
  })

  it('creates and persists a tournament', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    expect(result.current.tournament!.entrants).toHaveLength(4)
    expect(loadTournament()!.entrants).toHaveLength(4)
  })

  it('generates a round and persists it', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.nextRound())
    expect(result.current.tournament!.rounds).toHaveLength(1)
    expect(loadTournament()!.rounds).toHaveLength(1)
  })

  it('reports a result and persists it', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.nextRound())
    const matchId = result.current.tournament!.rounds[0].matches[0].id
    act(() => result.current.report(1, matchId, { gameWins: [2, 0], gameDraws: 0 }))
    expect(loadTournament()!.rounds[0].matches[0].result).toEqual({
      gameWins: [2, 0],
      gameDraws: 0,
    })
  })

  it('randomizes seats', () => {
    const { result } = renderHook(() => useTournament(seededRng([0.9, 0.1, 0.5])))
    act(() => result.current.start(startInput()))
    act(() => result.current.randomizeSeats())
    expect([...result.current.tournament!.entrants.map((e) => e.seat)].sort()).toEqual([1, 2, 3, 4])
  })

  it('moves a seat', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.moveSeat('entrant-2', -1))
    const seatOf = (id: string) => result.current.tournament!.entrants.find((e) => e.id === id)!.seat
    expect(seatOf('entrant-2')).toBe(1)
  })

  it('drops and reinstates an entrant', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.drop('entrant-2', 1))
    expect(result.current.tournament!.entrants[1].droppedAfterRound).toBe(1)
    act(() => result.current.reinstate('entrant-2'))
    expect(result.current.tournament!.entrants[1].droppedAfterRound).toBeNull()
  })

  it('swaps a pairing', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.nextRound())
    act(() => result.current.swap(1, 'entrant-1', 'entrant-2'))
    const pairs = result.current.tournament!.rounds[0].matches.map(
      (m) => `${m.entrantIds[0]}|${m.entrantIds[1]}`,
    )
    expect(pairs).toContain('entrant-2|entrant-3')
  })

  it('re-pairs later rounds', () => {
    saveTournament(
      makeTournament({
        entrants: makeEntrants(4),
        rounds: [
          round(1, [
            match('entrant-1', 'entrant-2', gameResult(2, 0)),
            match('entrant-3', 'entrant-4', gameResult(2, 0)),
          ]),
          round(2, [match('entrant-1', 'entrant-3', null)]),
        ],
      }),
    )
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.repairFrom(1))
    expect(result.current.tournament!.rounds).toHaveLength(2)
    expect(result.current.tournament!.rounds[1].matches).toHaveLength(2)
  })

  it('reports a forced rematch through hadToRepeatPairing', () => {
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', gameResult(2, 0))])],
      }),
    )
    const { result } = renderHook(() => useTournament(seededRng()))
    expect(result.current.hadToRepeatPairing).toBe(false)
    act(() => result.current.nextRound())
    expect(result.current.hadToRepeatPairing).toBe(true)
  })

  it('clears the tournament on reset', () => {
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.start(startInput()))
    act(() => result.current.reset())
    expect(result.current.tournament).toBeNull()
    expect(loadTournament()).toBeNull()
  })

  it('clears a stale forced-rematch warning when a new tournament starts', () => {
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', gameResult(2, 0))])],
      }),
    )
    const { result } = renderHook(() => useTournament(seededRng()))
    act(() => result.current.nextRound())
    expect(result.current.hadToRepeatPairing).toBe(true)
    act(() => result.current.start(startInput()))
    expect(result.current.hadToRepeatPairing).toBe(false)
  })

  describe('with no tournament in progress', () => {
    // Every mutation is a no-op rather than a crash, so a stray tap on a screen
    // mid-teardown can't throw.
    it.each([
      ['nextRound', (s: ReturnType<typeof useTournament>) => s.nextRound()],
      ['repairFrom', (s: ReturnType<typeof useTournament>) => s.repairFrom(1)],
      ['randomizeSeats', (s: ReturnType<typeof useTournament>) => s.randomizeSeats()],
      ['moveSeat', (s: ReturnType<typeof useTournament>) => s.moveSeat('entrant-1', 1)],
      ['report', (s: ReturnType<typeof useTournament>) => s.report(1, 'x', null)],
      ['drop', (s: ReturnType<typeof useTournament>) => s.drop('entrant-1', 1)],
      ['reinstate', (s: ReturnType<typeof useTournament>) => s.reinstate('entrant-1')],
      ['swap', (s: ReturnType<typeof useTournament>) => s.swap(1, 'a', 'b')],
    ])('%s leaves it null', (_name, callIt) => {
      const { result } = renderHook(() => useTournament(seededRng()))
      act(() => callIt(result.current))
      expect(result.current.tournament).toBeNull()
    })
  })
})
