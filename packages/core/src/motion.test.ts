import { beforeEach, describe, expect, it } from 'vitest'
import {
  prefersReducedMotion,
  resetReducedMotionSource,
  setReducedMotionSource,
  transitionDuration,
} from './motion'
import { motion } from './theme/tokens'

describe('motion', () => {
  beforeEach(() => {
    resetReducedMotionSource()
  })

  it('assumes no preference before a host registers a source', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reads the registered source', () => {
    setReducedMotionSource(() => true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('asks the source each time rather than caching', () => {
    // A native host updates its cached answer from an OS listener, so a value read
    // once at import would go stale the moment the setting changed mid-session.
    let reduced = false
    setReducedMotionSource(() => reduced)

    expect(prefersReducedMotion()).toBe(false)
    reduced = true
    expect(prefersReducedMotion()).toBe(true)
  })

  it('uses the standard duration normally', () => {
    expect(transitionDuration()).toBe(motion.duration.base)
  })

  it('collapses the duration to zero when reduced motion is asked for', () => {
    setReducedMotionSource(() => true)
    expect(transitionDuration()).toBe(0)
  })
})
