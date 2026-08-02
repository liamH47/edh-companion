import { useCallback, useState } from 'react'
import { clearTournament, loadTournament, saveTournament } from './storage'
import {
  assignSeatsRandomly,
  createTournament,
  dropEntrant,
  moveEntrantSeat,
  reinstateEntrant,
  repairRoundsFrom,
  reportResult,
  startNextRound,
  swapPairing,
  type CreateTournamentInput,
  type FirstRoundPairingMethod,
} from './tournament'
import type { MatchResult, Rng, Tournament } from './types'

/**
 * Owns the one active tournament: the pure transitions from tournament.ts, plus
 * persistence, so every screen below just calls a method and re-renders. The RNG is
 * injectable purely so tests can be deterministic.
 */
export interface TournamentSession {
  tournament: Tournament | null
  /** True when the last pairing had to repeat a matchup, so the UI can say so. */
  hadToRepeatPairing: boolean
  start: (input: CreateTournamentInput) => void
  randomizeSeats: () => void
  moveSeat: (entrantId: string, direction: -1 | 1) => void
  nextRound: (method?: FirstRoundPairingMethod) => void
  report: (roundNumber: number, matchId: string, result: MatchResult | null) => void
  repairFrom: (roundNumber: number) => void
  drop: (entrantId: string, afterRound: number) => void
  reinstate: (entrantId: string) => void
  swap: (roundNumber: number, entrantAId: string, entrantBId: string) => void
  reset: () => void
}

export function useTournament(rng: Rng = Math.random): TournamentSession {
  const [tournament, setTournament] = useState<Tournament | null>(() => loadTournament())
  const [hadToRepeatPairing, setHadToRepeatPairing] = useState(false)

  // Every mutation goes through here, so persistence can never be forgotten at one
  // call site and silently lose a round mid-draft.
  const commit = useCallback((next: Tournament) => {
    saveTournament(next)
    setTournament(next)
  }, [])

  const update = useCallback(
    (transition: (current: Tournament) => Tournament) => {
      setTournament((current) => {
        if (current === null) return current
        const next = transition(current)
        saveTournament(next)
        return next
      })
    },
    [],
  )

  const start = useCallback(
    (input: CreateTournamentInput) => {
      setHadToRepeatPairing(false)
      commit(createTournament(input))
    },
    [commit],
  )

  const randomizeSeats = useCallback(
    () => update((current) => assignSeatsRandomly(current, rng)),
    [update, rng],
  )

  const moveSeat = useCallback(
    (entrantId: string, direction: -1 | 1) =>
      update((current) => moveEntrantSeat(current, entrantId, direction)),
    [update],
  )

  const nextRound = useCallback(
    (method: FirstRoundPairingMethod = 'draft-seating') => {
      setTournament((current) => {
        if (current === null) return current
        const outcome = startNextRound(current, rng, method)
        setHadToRepeatPairing(outcome.hadToRepeatPairing)
        saveTournament(outcome.tournament)
        return outcome.tournament
      })
    },
    [rng],
  )

  const report = useCallback(
    (roundNumber: number, matchId: string, result: MatchResult | null) =>
      update((current) => reportResult(current, roundNumber, matchId, result)),
    [update],
  )

  const repairFrom = useCallback(
    (roundNumber: number) => {
      setTournament((current) => {
        if (current === null) return current
        const outcome = repairRoundsFrom(current, roundNumber, rng)
        setHadToRepeatPairing(outcome.hadToRepeatPairing)
        saveTournament(outcome.tournament)
        return outcome.tournament
      })
    },
    [rng],
  )

  const drop = useCallback(
    (entrantId: string, afterRound: number) =>
      update((current) => dropEntrant(current, entrantId, afterRound)),
    [update],
  )

  const reinstate = useCallback(
    (entrantId: string) => update((current) => reinstateEntrant(current, entrantId)),
    [update],
  )

  const swap = useCallback(
    (roundNumber: number, entrantAId: string, entrantBId: string) =>
      update((current) => swapPairing(current, roundNumber, entrantAId, entrantBId)),
    [update],
  )

  const reset = useCallback(() => {
    clearTournament()
    setHadToRepeatPairing(false)
    setTournament(null)
  }, [])

  return {
    tournament,
    hadToRepeatPairing,
    start,
    randomizeSeats,
    moveSeat,
    nextRound,
    report,
    repairFrom,
    drop,
    reinstate,
    swap,
    reset,
  }
}
