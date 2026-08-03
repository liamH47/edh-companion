/**
 * @vitest-environment jsdom
 *
 * This package runs on node by default -- almost all of it is pure. React hooks need
 * somewhere to render, so they opt in here rather than making every other file pay for
 * a DOM it never touches.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetStorageBackend } from '../storage'
import type { Rng } from '../swiss/types'
import { loadPodSession, savePodSession } from './storage'
import { usePodSession } from './usePodSession'

const rng: Rng = () => 0

afterEach(() => {
  resetStorageBackend()
})

describe('usePodSession', () => {
  it('starts with no session and resumes one already saved', () => {
    savePodSession({
      players: [{ id: 'player-1', name: 'Ava' }],
      rounds: [{ number: 1, hadToRepeatTable: false, pods: [{ seats: ['player-1'] }] }],
    })
    const { result } = renderHook(() => usePodSession(rng))
    expect(result.current.session?.players[0].name).toBe('Ava')
  })

  it('generates round 1 on start and persists it', () => {
    const { result } = renderHook(() => usePodSession(rng))
    expect(result.current.session).toBeNull()

    act(() => result.current.start(['Ava', 'Ben', 'Cara', 'Dev']))

    expect(result.current.session?.rounds).toHaveLength(1)
    expect(loadPodSession()?.rounds).toHaveLength(1)
  })

  it('adds a round and reshuffles the latest in place', () => {
    const { result } = renderHook(() => usePodSession(rng))
    act(() => result.current.start(['Ava', 'Ben', 'Cara', 'Dev']))

    act(() => result.current.nextRound())
    expect(result.current.session?.rounds).toHaveLength(2)

    act(() => result.current.reshuffle())
    expect(result.current.session?.rounds).toHaveLength(2)
  })

  it('resets back to no session', () => {
    const { result } = renderHook(() => usePodSession(rng))
    act(() => result.current.start(['Ava', 'Ben', 'Cara']))
    act(() => result.current.reset())

    expect(result.current.session).toBeNull()
    expect(loadPodSession()).toBeNull()
  })

  it('leaves the null session untouched when advancing before a start', () => {
    const { result } = renderHook(() => usePodSession(rng))
    act(() => result.current.nextRound())
    act(() => result.current.reshuffle())
    expect(result.current.session).toBeNull()
  })
})
