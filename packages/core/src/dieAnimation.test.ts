import { describe, expect, it } from 'vitest'
import {
  CONTACT_FRACTIONS,
  FIRST_CONTACT_FRACTION,
  rollKeyframes,
  totalDuration,
  transformParts,
} from './dieAnimation'

const TOTAL_MS = 900

describe('CONTACT_FRACTIONS', () => {
  it('is strictly increasing and stays inside the roll', () => {
    for (let i = 1; i < CONTACT_FRACTIONS.length; i += 1) {
      expect(CONTACT_FRACTIONS[i]).toBeGreaterThan(CONTACT_FRACTIONS[i - 1])
    }
    expect(CONTACT_FRACTIONS[0]).toBeGreaterThan(0)
    expect(CONTACT_FRACTIONS[CONTACT_FRACTIONS.length - 1]).toBeLessThan(1)
  })

  it('exposes the first contact as the sound-delay fraction', () => {
    expect(FIRST_CONTACT_FRACTION).toBe(CONTACT_FRACTIONS[0])
  })
})

describe('rollKeyframes', () => {
  it('plays for exactly the requested duration', () => {
    expect(totalDuration(rollKeyframes(TOTAL_MS, 1))).toBeCloseTo(TOTAL_MS, 6)
  })

  it('emits a rise/fall pair per contact plus a settle', () => {
    const frames = rollKeyframes(TOTAL_MS, 1)
    expect(frames).toHaveLength(CONTACT_FRACTIONS.length * 2 + 1)
  })

  it('marks exactly one contact per bounce, at the contact fractions', () => {
    const frames = rollKeyframes(TOTAL_MS, 1)
    const contactTimes: number[] = []
    let elapsed = 0
    for (const frame of frames) {
      elapsed += frame.durationMs
      if (frame.contact) contactTimes.push(elapsed / TOTAL_MS)
    }
    expect(contactTimes).toHaveLength(CONTACT_FRACTIONS.length)
    contactTimes.forEach((time, index) => {
      expect(time).toBeCloseTo(CONTACT_FRACTIONS[index], 6)
    })
  })

  it('touches down at translateY 0 on every contact and floats above it at each apex', () => {
    const frames = rollKeyframes(TOTAL_MS, 1)
    for (const frame of frames) {
      if (frame.contact) expect(frame.translateY).toBe(0)
    }
    // Rise frames (the frame before each contact frame) go up: negative Y.
    for (let i = 0; i < frames.length - 1; i += 1) {
      if (frames[i + 1].contact) expect(frames[i].translateY).toBeLessThan(0)
    }
  })

  it('accumulates rotation monotonically and ends past its final full turn', () => {
    const frames = rollKeyframes(TOTAL_MS, 7)
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].rotateDeg).toBeGreaterThanOrEqual(frames[i - 1].rotateDeg)
    }
    const final = frames[frames.length - 1]
    // 900deg of spin rounds up to 3 whole turns; the tilt stays within +/-12.
    expect(final.rotateDeg).toBeGreaterThanOrEqual(1080 - 12)
    expect(final.rotateDeg).toBeLessThanOrEqual(1080 + 12)
  })

  it('is deterministic for a seed and varies across seeds', () => {
    expect(rollKeyframes(TOTAL_MS, 42)).toEqual(rollKeyframes(TOTAL_MS, 42))
    const tiltOf = (seed: number) => rollKeyframes(TOTAL_MS, seed).at(-1)?.rotateDeg
    const tilts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(tiltOf))
    expect(tilts.size).toBeGreaterThan(1)
  })

  it('collapses to a single settle frame under reduced motion', () => {
    const frames = rollKeyframes(150, 9, true)
    expect(frames).toHaveLength(1)
    const [settle] = frames
    expect(settle.durationMs).toBe(150)
    expect(settle.translateX).toBe(0)
    expect(settle.translateY).toBe(0)
    expect(settle.scale).toBe(1)
    expect(settle.contact).toBe(true)
    expect(Math.abs(settle.rotateDeg)).toBeLessThanOrEqual(12)
  })

  it('ends settled: centred, full size, flat on the surface', () => {
    const final = rollKeyframes(TOTAL_MS, 3).at(-1)
    expect(final).toMatchObject({ translateX: 0, translateY: 0, scale: 1, contact: false })
  })
})

describe('transformParts', () => {
  it('names the transform components in the order both hosts must apply them', () => {
    const [frame] = rollKeyframes(TOTAL_MS, 1)
    expect(transformParts(frame)).toEqual({
      translateX: frame.translateX,
      translateY: frame.translateY,
      rotate: frame.rotateDeg,
      scale: frame.scale,
    })
  })
})
