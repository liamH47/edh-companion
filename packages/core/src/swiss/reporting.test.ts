import { describe, expect, it } from 'vitest'
import type { Match, MatchResult } from './types'
import {
  drawCap,
  drawCount,
  winCap,
  winCounts,
  withDrawDelta,
  withPodDraw,
  withPodWinner,
  withWinDelta,
} from './reporting'

function match(entrantCount: number, result: MatchResult | null = null): Match {
  const entrantIds = Array.from({ length: entrantCount }, (_unused, i) => `entrant-${i + 1}`)
  return { id: entrantIds.join('-vs-'), entrantIds, result }
}

describe('caps', () => {
  it('caps wins at the winning threshold per format', () => {
    expect(winCap('bo3')).toBe(2)
    expect(winCap('bo1')).toBe(1)
  })

  it('caps draws at the games a match can physically hold', () => {
    expect(drawCap('bo3')).toBe(3)
    expect(drawCap('bo1')).toBe(1)
  })
})

describe('winCounts / drawCount', () => {
  it('zero-fills an unreported match so the UI renders one shape', () => {
    expect(winCounts(match(2))).toEqual([0, 0])
    expect(winCounts(match(4))).toEqual([0, 0, 0, 0])
    expect(drawCount(match(2))).toBe(0)
  })

  it('passes a reported result through', () => {
    const reported = match(2, { gameWins: [2, 1], gameDraws: 1 })
    expect(winCounts(reported)).toEqual([2, 1])
    expect(drawCount(reported)).toBe(1)
  })
})

describe('withWinDelta', () => {
  it('adds the first win to an unreported match', () => {
    expect(withWinDelta(match(2), 0, 1, 'bo3')).toEqual({ gameWins: [1, 0], gameDraws: 0 })
  })

  it('adds to the tapped entrant only', () => {
    const current = match(2, { gameWins: [1, 0], gameDraws: 0 })
    expect(withWinDelta(current, 1, 1, 'bo3')).toEqual({ gameWins: [1, 1], gameDraws: 0 })
  })

  it('clamps at the bo3 cap rather than recording a third win', () => {
    const current = match(2, { gameWins: [2, 1], gameDraws: 0 })
    expect(withWinDelta(current, 0, 1, 'bo3')).toEqual({ gameWins: [2, 1], gameDraws: 0 })
  })

  it('clamps at the bo1 cap', () => {
    const current = match(2, { gameWins: [1, 0], gameDraws: 0 })
    expect(withWinDelta(current, 0, 1, 'bo1')).toEqual({ gameWins: [1, 0], gameDraws: 0 })
  })

  it('clamps a decrement at zero', () => {
    const current = match(2, { gameWins: [0, 2], gameDraws: 1 })
    expect(withWinDelta(current, 0, -1, 'bo3')).toEqual({ gameWins: [0, 2], gameDraws: 1 })
  })

  it('stays null when decrementing an unreported match', () => {
    expect(withWinDelta(match(2), 0, -1, 'bo3')).toBeNull()
  })

  it('collapses to null when the last win is removed -- Not reported is reachable again', () => {
    const current = match(2, { gameWins: [1, 0], gameDraws: 0 })
    expect(withWinDelta(current, 0, -1, 'bo3')).toBeNull()
  })

  it('does not collapse while a drawn game remains', () => {
    const current = match(2, { gameWins: [1, 0], gameDraws: 1 })
    expect(withWinDelta(current, 0, -1, 'bo3')).toEqual({ gameWins: [0, 0], gameDraws: 1 })
  })
})

describe('withDrawDelta', () => {
  it('records a drawn game on an unreported match -- a draw is a real result, not null', () => {
    expect(withDrawDelta(match(2), 1, 'bo3')).toEqual({ gameWins: [0, 0], gameDraws: 1 })
  })

  it('clamps at the bo3 draw cap', () => {
    const current = match(2, { gameWins: [0, 0], gameDraws: 3 })
    expect(withDrawDelta(current, 1, 'bo3')).toEqual({ gameWins: [0, 0], gameDraws: 3 })
  })

  it('clamps at the bo1 draw cap', () => {
    const current = match(2, { gameWins: [0, 0], gameDraws: 1 })
    expect(withDrawDelta(current, 1, 'bo1')).toEqual({ gameWins: [0, 0], gameDraws: 1 })
  })

  it('collapses to null when the only drawn game is removed', () => {
    const current = match(2, { gameWins: [0, 0], gameDraws: 1 })
    expect(withDrawDelta(current, -1, 'bo3')).toBeNull()
  })

  it('keeps the wins when a draw is removed from a mixed result', () => {
    const current = match(2, { gameWins: [1, 1], gameDraws: 1 })
    expect(withDrawDelta(current, -1, 'bo3')).toEqual({ gameWins: [1, 1], gameDraws: 0 })
  })

  it('stays null when decrementing an unreported match', () => {
    expect(withDrawDelta(match(2), -1, 'bo1')).toBeNull()
  })
})

describe('withPodWinner', () => {
  it.each([2, 3, 4])('sets the single 1 at any table size (%i players)', (size) => {
    const result = withPodWinner(match(size), 1)
    expect(result.gameWins).toHaveLength(size)
    expect(result.gameWins[1]).toBe(1)
    expect(result.gameWins.filter((w) => w === 1)).toHaveLength(1)
    expect(result.gameDraws).toBe(0)
  })

  it('moves the win rather than adding a second one', () => {
    const current = match(4, { gameWins: [0, 1, 0, 0], gameDraws: 0 })
    expect(withPodWinner(current, 3)).toEqual({ gameWins: [0, 0, 0, 1], gameDraws: 0 })
  })

  it('replaces a draw with the winner', () => {
    const current = match(3, { gameWins: [0, 0, 0], gameDraws: 1 })
    expect(withPodWinner(current, 0)).toEqual({ gameWins: [1, 0, 0], gameDraws: 0 })
  })
})

describe('withPodDraw', () => {
  it('records the timed-out pod: nobody won, one shared drawn game', () => {
    expect(withPodDraw(match(4))).toEqual({ gameWins: [0, 0, 0, 0], gameDraws: 1 })
  })

  it('replaces a winner with the draw', () => {
    const current = match(3, { gameWins: [1, 0, 0], gameDraws: 0 })
    expect(withPodDraw(current)).toEqual({ gameWins: [0, 0, 0], gameDraws: 1 })
  })
})
