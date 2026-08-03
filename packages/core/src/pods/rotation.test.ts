import { describe, expect, it } from 'vitest'
import type { Rng } from '../swiss/types'
import {
  buildPods,
  createPodSession,
  generateNextRound,
  reshuffleLatestRound,
  timesTogether,
} from './rotation'
import type { PodSession } from './types'

// A constant RNG makes Fisher-Yates deterministic (j is always 0), so pod membership
// is reproducible without asserting a particular random order.
const rng: Rng = () => 0

const seatsOf = (session: PodSession, roundIndex: number) =>
  session.rounds[roundIndex].pods.map((pod) => pod.seats)

const allSeats = (session: PodSession, roundIndex: number) =>
  seatsOf(session, roundIndex).flat()

describe('createPodSession', () => {
  it('gives each player a stable id and no rounds yet', () => {
    const session = createPodSession(['Ava', 'Ben', 'Cara'])
    expect(session.players).toEqual([
      { id: 'player-1', name: 'Ava' },
      { id: 'player-2', name: 'Ben' },
      { id: 'player-3', name: 'Cara' },
    ])
    expect(session.rounds).toEqual([])
  })
})

describe('timesTogether', () => {
  it('counts shared tables and ignores players in different pods', () => {
    const session: PodSession = {
      players: [],
      rounds: [
        { number: 1, hadToRepeatTable: false, pods: [{ seats: ['a', 'b'] }, { seats: ['c', 'd'] }] },
        { number: 2, hadToRepeatTable: false, pods: [{ seats: ['a', 'b'] }, { seats: ['c', 'd'] }] },
      ],
    }
    expect(timesTogether('a', 'b', session)).toBe(2)
    expect(timesTogether('a', 'c', session)).toBe(0)
  })
})

describe('buildPods', () => {
  it('splits six players into two pods of three, everyone seated once', () => {
    const session = createPodSession(['Ava', 'Ben', 'Cara', 'Dev', 'Eve', 'Fin'])
    const { pods, hadToRepeatTable } = buildPods(
      session.players.map((player) => player.id),
      session,
      rng,
    )
    expect(pods.map((pod) => pod.seats.length)).toEqual([3, 3])
    expect(pods.flatMap((pod) => pod.seats).sort()).toEqual([
      'player-1',
      'player-2',
      'player-3',
      'player-4',
      'player-5',
      'player-6',
    ])
    expect(hadToRepeatTable).toBe(false)
  })
})

describe('generateNextRound', () => {
  it('appends a fresh, repeat-free round for a big enough field', () => {
    const session = generateNextRound(createPodSession(['Ava', 'Ben', 'Cara', 'Dev']), rng)
    expect(session.rounds).toHaveLength(1)
    expect(session.rounds[0].number).toBe(1)
    expect(allSeats(session, 0).sort()).toEqual(['player-1', 'player-2', 'player-3', 'player-4'])
    expect(session.rounds[0].hadToRepeatTable).toBe(false)
  })

  it('flags a repeat once the whole group has already played each other', () => {
    let session = createPodSession(['Ava', 'Ben', 'Cara'])
    session = generateNextRound(session, rng)
    session = generateNextRound(session, rng)

    expect(session.rounds[0].hadToRepeatTable).toBe(false)
    // Three players are always one pod, so round two necessarily repeats the table.
    expect(session.rounds[1].hadToRepeatTable).toBe(true)
  })
})

describe('reshuffleLatestRound', () => {
  it('replaces the latest round in place rather than adding one', () => {
    const session = generateNextRound(createPodSession(['Ava', 'Ben', 'Cara', 'Dev']), rng)
    const reshuffled = reshuffleLatestRound(session, rng)
    expect(reshuffled.rounds).toHaveLength(1)
    expect(reshuffled.rounds[0].number).toBe(1)
  })

  it('is a no-op before any round has been generated', () => {
    const session = createPodSession(['Ava', 'Ben', 'Cara'])
    expect(reshuffleLatestRound(session, rng)).toBe(session)
  })
})
