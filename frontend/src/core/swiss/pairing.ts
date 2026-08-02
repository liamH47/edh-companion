import { computeStandings } from './scoring'
import type { Entrant, Match, Rng, Standing, Tournament } from './types'

/** Fisher-Yates, with the RNG injected so tests are deterministic. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Derived from the participants rather than a counter, so it survives a reload: an
 * entrant plays at most one match per round, which makes this unique within its round
 * -- and round number plus match id is how every lookup is keyed.
 */
function matchId(aEntrantId: string, bEntrantId: string | null): string {
  return `${aEntrantId}-vs-${bEntrantId ?? 'bye'}`
}

/** Exported so anything that rewrites a pairing (swapPairing) rebuilds through here
 * rather than spreading the old match, which would keep an id naming the wrong
 * players. */
export function makeMatch(aEntrantId: string, bEntrantId: string): Match {
  return { id: matchId(aEntrantId, bEntrantId), aEntrantId, bEntrantId, result: null }
}

/** A bye is recorded as a 2-0 win straight away -- there's no match to play and
 * nothing for the player to report. */
export function makeBye(entrantId: string): Match {
  return {
    id: matchId(entrantId, null),
    aEntrantId: entrantId,
    bEntrantId: null,
    result: { aGameWins: 2, bGameWins: 0, gameDraws: 0 },
  }
}

/**
 * Round 1 from draft seating: seat `i` plays seat `i + floor(N/2)` -- the players
 * sitting furthest apart in the pod, who passed each other the fewest cards and so
 * know each other's decks least. A 6-pod gives 1v4, 2v5, 3v6; an 8-pod gives 1v5,
 * 2v6, 3v7, 4v8. An odd pod byes the last seat.
 */
export function seatPairings(entrants: Entrant[]): Match[] {
  const bySeat = [...entrants].sort((a, b) => a.seat - b.seat)
  const half = Math.floor(bySeat.length / 2)

  const matches = Array.from({ length: half }, (_unused, index) =>
    makeMatch(bySeat[index].id, bySeat[index + half].id),
  )
  if (bySeat.length % 2 === 1) matches.push(makeBye(bySeat[bySeat.length - 1].id))
  return matches
}

/** Round 1 for events with no draft seating (Sealed): pair at random. */
export function randomFirstRoundPairings(entrants: Entrant[], rng: Rng): Match[] {
  const shuffled = shuffle(entrants, rng)
  const matches: Match[] = []
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    matches.push(makeMatch(shuffled[i].id, shuffled[i + 1].id))
  }
  if (shuffled.length % 2 === 1) matches.push(makeBye(shuffled[shuffled.length - 1].id))
  return matches
}

/** Entrants still in for the given round. `droppedAfterRound: 1` means they played
 * round 1 and are out from round 2 onward. */
export function activeEntrantsForRound(tournament: Tournament, roundNumber: number): Entrant[] {
  return tournament.entrants.filter(
    (entrant) => entrant.droppedAfterRound === null || entrant.droppedAfterRound >= roundNumber,
  )
}

export function havePlayed(aId: string, bId: string, tournament: Tournament): boolean {
  return tournament.rounds.some((round) =>
    round.matches.some(
      (match) =>
        (match.aEntrantId === aId && match.bEntrantId === bId) ||
        (match.aEntrantId === bId && match.bEntrantId === aId),
    ),
  )
}

function hasHadBye(entrantId: string, tournament: Tournament): boolean {
  return tournament.rounds.some((round) =>
    round.matches.some((match) => match.bEntrantId === null && match.aEntrantId === entrantId),
  )
}

/**
 * Recursive backtracking over a standings-ordered list. Taking the first unpaired
 * entrant and trying partners in order means the closest-ranked legal opponent is
 * tried first, which is what keeps score groups together and floats the odd player
 * down a group -- no explicit score-group bookkeeping needed. Exhaustive, but pod
 * sized: 8 entrants is a handful of branches, not a search space.
 */
function pairRecursively(
  ids: string[],
  tournament: Tournament,
  allowRematches: boolean,
): Match[] | null {
  if (ids.length === 0) return []

  const [first, ...rest] = ids
  for (let i = 0; i < rest.length; i++) {
    const candidate = rest[i]
    if (!allowRematches && havePlayed(first, candidate, tournament)) continue
    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)]
    const tail = pairRecursively(remaining, tournament, allowRematches)
    if (tail !== null) return [makeMatch(first, candidate), ...tail]
  }
  return null
}

/**
 * Standings order with ties broken randomly rather than by seat. Sorting a shuffled
 * list on only the four real tiebreakers relies on Array.sort being stable (ES2019+),
 * so entrants who are genuinely tied keep their shuffled order -- that's the
 * randomisation real Swiss does within a score group. Using computeStandings' rank
 * directly would instead make every pairing a fixed function of the results, so the
 * same two players would meet again and again in a small pod.
 */
function orderForPairing(active: Entrant[], tournament: Tournament, rng: Rng): string[] {
  const standingByEntrant = new Map<string, Standing>(
    computeStandings(tournament).map((standing) => [standing.entrantId, standing]),
  )
  const compare = (a: Entrant, b: Entrant) => {
    const left = standingByEntrant.get(a.id)!
    const right = standingByEntrant.get(b.id)!
    return (
      right.matchPoints - left.matchPoints ||
      right.opponentsMatchWinPercentage - left.opponentsMatchWinPercentage ||
      right.gameWinPercentage - left.gameWinPercentage ||
      right.opponentsGameWinPercentage - left.opponentsGameWinPercentage
    )
  }
  return shuffle(active, rng).sort(compare).map((entrant) => entrant.id)
}

export interface PairingOutcome {
  matches: Match[]
  /** True when no rematch-free pairing existed and one had to be repeated -- surfaced
   * so the UI can say so rather than silently repeating a matchup. */
  hadToRepeatPairing: boolean
}

/**
 * Pairings for round 2 onward: standings order, bye to the lowest-ranked entrant who
 * hasn't had one, then a rematch-free pairing of everyone else. Falls back to
 * allowing rematches only when the field genuinely has no alternative (a small pod
 * playing enough rounds that everyone has already met).
 */
export function swissPairings(
  tournament: Tournament,
  roundNumber: number,
  rng: Rng,
): PairingOutcome {
  const ordered = orderForPairing(activeEntrantsForRound(tournament, roundNumber), tournament, rng)

  if (ordered.length % 2 === 0) {
    const withoutRematches = pairRecursively(ordered, tournament, false)
    if (withoutRematches !== null) {
      return { matches: withoutRematches, hadToRepeatPairing: false }
    }
    // Cannot be null: the field is even, and with rematches allowed every partner is
    // legal, so the first branch of the search always succeeds.
    return { matches: pairRecursively(ordered, tournament, true)!, hadToRepeatPairing: true }
  }

  // An odd field means someone sits out, and *who* is a real choice rather than a
  // foregone one. Preference order is lowest-ranked first (the bye goes to whoever is
  // doing worst), skipping anyone who already had one. But a given bye choice can
  // leave behind a set that cannot be paired without a rematch when a different,
  // equally legal choice could -- so try them in preference order and take the first
  // that pairs cleanly, rather than committing to the first and reporting a repeat
  // that was never necessary.
  const byPreference = [...ordered].reverse()
  const withoutByeYet = byPreference.filter((id) => !hasHadBye(id, tournament))
  const candidates = withoutByeYet.length > 0 ? withoutByeYet : byPreference

  for (const byeId of candidates) {
    const rest = ordered.filter((id) => id !== byeId)
    const paired = pairRecursively(rest, tournament, false)
    if (paired !== null) {
      return { matches: [makeBye(byeId), ...paired], hadToRepeatPairing: false }
    }
  }

  // No legal bye avoids a rematch, so fall back to the preferred recipient and repeat
  // a pairing. Never null, for the same reason as the even case above.
  const byeId = candidates[0]
  const rest = ordered.filter((id) => id !== byeId)
  return {
    matches: [makeBye(byeId), ...pairRecursively(rest, tournament, true)!],
    hadToRepeatPairing: true,
  }
}
