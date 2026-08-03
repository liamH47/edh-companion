/**
 * Casual Commander pod rotation. Pure data -- no React, no DOM, no storage -- so the
 * generation logic ports to React Native untouched, exactly like the Swiss module beside it.
 *
 * This is the *scoreless* sibling of a Swiss tournament: a playgroup that just wants to
 * split into tables and reshuffle every round so people meet new opponents, with no
 * results to report and no standings to keep. The pod-sizing and repeat-minimising
 * logic is shared with Swiss (`swiss/pods` and the greedy fill in `swiss/pairing`); what
 * differs is that nothing here records who won.
 */

export interface PodPlayer {
  id: string
  name: string
}

/** One table. `seats` are player ids in the order they were assigned -- there is no
 * winner and no result, only who is sitting together. */
export interface Pod {
  seats: string[]
}

export interface PodRound {
  number: number
  pods: Pod[]
  /** True when the field is small enough that some pair had already shared a table and
   * the round had to seat them together again -- surfaced so the UI can say so rather
   * than pretending every round is fresh. */
  hadToRepeatTable: boolean
}

export interface PodSession {
  players: PodPlayer[]
  rounds: PodRound[]
}
