/**
 * Result arithmetic for tap-to-score reporting: each function takes a match and
 * returns the next `MatchResult | null` after one tap. Pure data in, pure data out --
 * the UI never mutates a result, it derives the next one and hands it to `report`.
 *
 * Two shapes, chosen by the *event*, not the table size:
 *
 * - **1v1 counting** (draft/sealed/constructed): tap a name to add a game win, capped
 *   at the format's winning threshold per player. Deliberately no cross-player
 *   constraint -- a TO entering a finished 2-1 naturally taps A, A, B, and blocking
 *   "+" the moment anyone reaches the cap would make that third tap dead. The
 *   degenerate 2-2 this permits scores as a draw under `outcomeFor`'s tie rule, and
 *   the row's own scoreline reading "Draw" is the visible tell.
 * - **Pod set-winner** (commander): a pod is a single game with one survivor, so
 *   tapping a name SETS the winner (the single 1 moves) rather than counting. This is
 *   what keeps `[1, 1, 0, 0]` unreachable from the UI, and it applies to a 2-player
 *   commander duel too -- which is why callers branch on `eventFormat`, never on
 *   `entrantIds.length`.
 *
 * When every count returns to zero the result collapses to `null`: "Not reported"
 * stays reachable by plain decrementing, so no separate Clear control exists.
 */

import type { Match, MatchFormat, MatchResult } from './types'

/** Games a player must win to take the match -- also the per-player tap cap. */
export function winCap(format: MatchFormat): number {
  return format === 'bo3' ? 2 : 1
}

/** Drawn games a match can physically hold (bo3: all three games drawn). */
export function drawCap(format: MatchFormat): number {
  return format === 'bo3' ? 3 : 1
}

/** Per-entrant win counts, zero-filled when unreported so the UI renders one shape. */
export function winCounts(match: Match): number[] {
  return match.result?.gameWins ?? match.entrantIds.map(() => 0)
}

export function drawCount(match: Match): number {
  return match.result?.gameDraws ?? 0
}

/** All-zero collapses to null rather than recording a match nobody played. */
function normalized(gameWins: number[], gameDraws: number): MatchResult | null {
  if (gameDraws === 0 && gameWins.every((wins) => wins === 0)) return null
  return { gameWins, gameDraws }
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value))
}

/** One tap on a name (+1) or its undo (-1), clamped to [0, winCap]. */
export function withWinDelta(
  match: Match,
  entrantIndex: number,
  delta: 1 | -1,
  format: MatchFormat,
): MatchResult | null {
  const wins = winCounts(match).map((count, index) =>
    index === entrantIndex ? clamp(count + delta, winCap(format)) : count,
  )
  return normalized(wins, drawCount(match))
}

/** One tap on the Draw line (+1) or its undo (-1), clamped to [0, drawCap]. A result
 * of all-zero wins with a draw is NOT null -- a drawn game really happened. */
export function withDrawDelta(
  match: Match,
  delta: 1 | -1,
  format: MatchFormat,
): MatchResult | null {
  return normalized(winCounts(match), clamp(drawCount(match) + delta, drawCap(format)))
}

/** Pod: this entrant won -- the single 1 moves to them, clearing any draw. */
export function withPodWinner(match: Match, entrantIndex: number): MatchResult {
  return {
    gameWins: match.entrantIds.map((_unused, index) => (index === entrantIndex ? 1 : 0)),
    gameDraws: 0,
  }
}

/** Pod: the game timed out -- nobody won, one shared drawn game. */
export function withPodDraw(match: Match): MatchResult {
  return { gameWins: match.entrantIds.map(() => 0), gameDraws: 1 }
}
