import { describe, expect, it } from 'vitest'
import { IDEAL_POD_SIZE, MIN_POD_SIZE, podSizes } from './pods'

describe('podSizes', () => {
  it('matches the intended split for every realistic field size', () => {
    expect(podSizes(3)).toEqual([3])
    expect(podSizes(4)).toEqual([4])
    expect(podSizes(6)).toEqual([3, 3])
    expect(podSizes(7)).toEqual([4, 3])
    expect(podSizes(8)).toEqual([4, 4])
    expect(podSizes(9)).toEqual([3, 3, 3])
    expect(podSizes(10)).toEqual([4, 3, 3])
    expect(podSizes(11)).toEqual([4, 4, 3])
    expect(podSizes(12)).toEqual([4, 4, 4])
    expect(podSizes(13)).toEqual([4, 3, 3, 3])
    expect(podSizes(16)).toEqual([4, 4, 4, 4])
  })

  it('puts all five players at one table, because 5 is not 4a + 3b', () => {
    // The only count from 3 up that no combination of threes and fours can reach.
    // A pod of four plus a bye would obey the size rule but sit somebody out, which
    // is the wrong trade in Commander.
    expect(podSizes(5)).toEqual([5])
  })

  it('seats everyone, at every size', () => {
    for (let n = 1; n <= 64; n++) {
      const sizes = podSizes(n)
      expect(sizes.reduce((total, size) => total + size, 0), `n=${n}`).toBe(n)
    }
  })

  it('never drops below the minimum pod size once a real field exists', () => {
    for (let n = MIN_POD_SIZE; n <= 64; n++) {
      for (const size of podSizes(n)) {
        expect(size, `n=${n}`).toBeGreaterThanOrEqual(MIN_POD_SIZE)
      }
    }
  })

  it('uses pods of three only where a four is impossible', () => {
    // At most three threes: a fourth could be traded for three fours (3x4 = 4x3).
    for (let n = MIN_POD_SIZE; n <= 64; n++) {
      if (n === 5) continue
      const threes = podSizes(n).filter((size) => size === MIN_POD_SIZE).length
      expect(threes, `n=${n}`).toBeLessThanOrEqual(3)
    }
  })

  it('uses only threes and fours for every count except five', () => {
    for (let n = MIN_POD_SIZE; n <= 64; n++) {
      if (n === 5) continue
      for (const size of podSizes(n)) {
        expect([MIN_POD_SIZE, IDEAL_POD_SIZE], `n=${n}`).toContain(size)
      }
    }
  })

  it('sorts pods largest first, so fours come before threes', () => {
    for (let n = MIN_POD_SIZE; n <= 64; n++) {
      const sizes = podSizes(n)
      expect([...sizes].sort((a, b) => b - a), `n=${n}`).toEqual(sizes)
    }
  })

  it('seats a field too small to pod at a single table', () => {
    // Two players choosing Commander get a duel rather than an error.
    expect(podSizes(2)).toEqual([2])
    expect(podSizes(1)).toEqual([1])
  })

  it('produces nothing for an empty field', () => {
    expect(podSizes(0)).toEqual([])
  })
})
