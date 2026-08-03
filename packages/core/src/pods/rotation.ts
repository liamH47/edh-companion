import { shuffle } from '../swiss/pairing'
import { podSizes } from '../swiss/pods'
import type { Rng } from '../swiss/types'
import type { Pod, PodRound, PodSession } from './types'

/**
 * Below three players there is no pod to make -- a table of two is a duel, which this
 * casual tool isn't for. The Swiss module seats a duel rather than refuse it, but here
 * the whole point is splitting a larger group into tables, so the setup screen holds
 * the floor at three and generation never sees fewer.
 */
export const MIN_PLAYERS = 3

export function createPodSession(names: string[]): PodSession {
  return {
    players: names.map((name, index) => ({ id: `player-${index + 1}`, name })),
    rounds: [],
  }
}

/** How many times these two have already shared a table across every prior round. Used
 * as the cost to minimise, so the seating spreads meetings evenly rather than merely
 * avoiding a straight repeat -- which is what "so people get to play more of each
 * other" actually asks for. */
export function timesTogether(aId: string, bId: string, session: PodSession): number {
  let count = 0
  for (const round of session.rounds) {
    for (const pod of round.pods) {
      if (pod.seats.includes(aId) && pod.seats.includes(bId)) count++
    }
  }
  return count
}

export interface BuiltPods {
  pods: Pod[]
  hadToRepeatTable: boolean
}

/**
 * Splits the players into pods that minimise repeat tablemates.
 *
 * The same greedy shape as `swiss/pairing.podPairings`, with two deliberate changes for
 * a scoreless casual game: the order is a plain shuffle rather than standings order
 * (there are no standings), and the cost each candidate is scored on is the *total*
 * number of times they've already sat with the pod so far, not a yes/no rematch flag --
 * so when repeats are unavoidable the seating still prefers the pair who've met least.
 * Pod sizes come from the shared `podSizes`, so 6 -> [3,3], 7 -> [4,3], 8 -> [4,4].
 */
export function buildPods(playerIds: string[], session: PodSession, rng: Rng): BuiltPods {
  const ordered = shuffle(playerIds, rng)
  const remaining = [...ordered]
  const pods: Pod[] = []
  let hadToRepeatTable = false

  for (const size of podSizes(ordered.length)) {
    const seats = [remaining.shift()!]

    while (seats.length < size) {
      let bestIndex = 0
      let fewestMeetings = Infinity
      for (let i = 0; i < remaining.length; i++) {
        const meetings = seats.reduce(
          (sum, seated) => sum + timesTogether(seated, remaining[i], session),
          0,
        )
        if (meetings < fewestMeetings) {
          fewestMeetings = meetings
          bestIndex = i
          // Nothing beats a table nobody at it has shared, and `remaining` is already
          // shuffled, so taking the first such candidate keeps the choice random.
          if (meetings === 0) break
        }
      }
      if (fewestMeetings > 0) hadToRepeatTable = true
      seats.push(remaining.splice(bestIndex, 1)[0])
    }

    pods.push({ seats })
  }

  return { pods, hadToRepeatTable }
}

/** Appends a fresh round, seated to minimise repeats against every round so far. */
export function generateNextRound(session: PodSession, rng: Rng): PodSession {
  const { pods, hadToRepeatTable } = buildPods(
    session.players.map((player) => player.id),
    session,
    rng,
  )
  const round: PodRound = { number: session.rounds.length + 1, pods, hadToRepeatTable }
  return { ...session, rounds: [...session.rounds, round] }
}

/**
 * Re-seats the most recent round: drops it and regenerates against the earlier history,
 * so a reshuffle that a table doesn't like still respects who has already played whom in
 * previous rounds. A no-op when nothing has been generated yet.
 */
export function reshuffleLatestRound(session: PodSession, rng: Rng): PodSession {
  if (session.rounds.length === 0) return session
  const earlier: PodSession = { ...session, rounds: session.rounds.slice(0, -1) }
  return generateNextRound(earlier, rng)
}
