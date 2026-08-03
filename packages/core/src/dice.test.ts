import { afterEach, describe, expect, it, vi } from 'vitest'
import { rollDie, rollDice } from './dice'

describe('rollDie', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never rolls below 1, even at rng 0', () => {
    expect(rollDie(6, () => 0)).toBe(1)
  })

  it('never rolls above the face count, even at rng approaching 1', () => {
    // Math.random() gets arbitrarily close to 1 but never reaches it.
    expect(rollDie(6, () => 0.999999)).toBe(6)
    expect(rollDie(20, () => 0.999999)).toBe(20)
  })

  it('maps the midpoint to the middle of the range', () => {
    expect(rollDie(6, () => 0.5)).toBe(4)
  })

  it('defaults to Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollDie(20)).toBe(1)
  })
})

describe('rollDice', () => {
  it('returns one result per die', () => {
    expect(rollDice(2, 6, () => 0)).toEqual([1, 1])
  })

  it('rolls each die independently, in order', () => {
    const draws = [0, 0.999999]
    let i = 0
    const rng = () => draws[i++]
    expect(rollDice(2, 6, rng)).toEqual([1, 6])
  })

  it('returns an empty list for a count of zero', () => {
    expect(rollDice(0, 6, () => 0.5)).toEqual([])
  })

  it('defaults to Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    expect(rollDice(1, 6)).toEqual([6])
    vi.restoreAllMocks()
  })
})
