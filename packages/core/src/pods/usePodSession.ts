import { useCallback, useState } from 'react'
import type { Rng } from '../swiss/types'
import { createPodSession, generateNextRound, reshuffleLatestRound } from './rotation'
import { clearPodSession, loadPodSession, savePodSession } from './storage'
import type { PodSession } from './types'

/**
 * Owns the one active casual pod session: the pure transitions from rotation.ts plus
 * persistence, so every screen below just calls a method and re-renders. Mirrors
 * `useTournament`, minus everything to do with results and standings. The RNG is
 * injectable purely so tests can be deterministic.
 */
export interface PodSessionState {
  session: PodSession | null
  /** Creates the session and immediately seats round 1, so "generate pods" is one tap. */
  start: (names: string[]) => void
  nextRound: () => void
  reshuffle: () => void
  reset: () => void
}

export function usePodSession(rng: Rng = Math.random): PodSessionState {
  const [session, setSession] = useState<PodSession | null>(() => loadPodSession())

  // Every mutation persists, so a round can never be shown but forgotten on reload.
  const commit = useCallback((next: PodSession) => {
    savePodSession(next)
    setSession(next)
  }, [])

  const update = useCallback(
    (transition: (current: PodSession) => PodSession) => {
      setSession((current) => {
        if (current === null) return current
        const next = transition(current)
        savePodSession(next)
        return next
      })
    },
    [],
  )

  const start = useCallback(
    (names: string[]) => commit(generateNextRound(createPodSession(names), rng)),
    [commit, rng],
  )

  const nextRound = useCallback(
    () => update((current) => generateNextRound(current, rng)),
    [update, rng],
  )

  const reshuffle = useCallback(
    () => update((current) => reshuffleLatestRound(current, rng)),
    [update, rng],
  )

  const reset = useCallback(() => {
    clearPodSession()
    setSession(null)
  }, [])

  return { session, start, nextRound, reshuffle, reset }
}
