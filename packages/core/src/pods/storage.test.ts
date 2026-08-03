import { describe, expect, it } from 'vitest'
import { clearPodSession, loadPodSession, savePodSession } from './storage'
import type { PodSession } from './types'

const session: PodSession = {
  players: [{ id: 'player-1', name: 'Ava' }],
  rounds: [{ number: 1, hadToRepeatTable: false, pods: [{ seats: ['player-1'] }] }],
}

describe('pod session storage', () => {
  it('returns null when nothing is saved', () => {
    expect(loadPodSession()).toBeNull()
  })

  it('round-trips a saved session', () => {
    savePodSession(session)
    expect(loadPodSession()).toEqual(session)
  })

  it('clears a saved session back to null', () => {
    savePodSession(session)
    clearPodSession()
    expect(loadPodSession()).toBeNull()
  })
})
