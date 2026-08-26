import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionSource } from '@mtg/core'
import { Die3D } from './Die3D'

/**
 * A hand-cranked requestAnimationFrame: frames fire only when the test advances them,
 * with explicit timestamps, so the sampled t is exact rather than wall-clock flaky.
 */
let frameQueue: FrameRequestCallback[]
let now: number

function crankFrames(steps: number, msPerFrame = 100) {
  for (let i = 0; i < steps; i += 1) {
    now += msPerFrame
    const callbacks = frameQueue
    frameQueue = []
    act(() => {
      callbacks.forEach((callback) => callback(now))
    })
  }
}

const polygonCount = () => document.querySelectorAll('polygon').length
const pipCount = () =>
  document.querySelectorAll('circle[fill="var(--color-text)"]').length
const numeral = () => document.querySelector('text')?.textContent

describe('Die3D', () => {
  beforeEach(() => {
    frameQueue = []
    now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameQueue.push(callback)
      return frameQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    setReducedMotionSource(() => false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the rolled face with pips at rest', () => {
    render(<Die3D face={5} faces={6} rolling={false} durationMs={900} />)
    // Rest is roll-only tilt: exactly one cube face is visible.
    expect(polygonCount()).toBeGreaterThanOrEqual(1)
    expect(pipCount()).toBe(5)
  })

  it('defaults to the compact box, so the card action bar is unaffected', () => {
    const { container } = render(<Die3D face={1} faces={6} rolling={false} durationMs={900} />)
    expect(container.querySelector('svg')).toHaveClass('h-24', 'w-24')
  })

  it('renders the larger box when a screen with room opts into it', () => {
    // The Dice tab passes size="lg"; the geometry is unitless so only the box changes.
    const { container } = render(
      <Die3D face={1} faces={6} rolling={false} durationMs={900} size="lg" />,
    )
    expect(container.querySelector('svg')).toHaveClass('h-40', 'w-40')
  })

  it('renders a true icosahedron for a d20 with an upright numeral', () => {
    render(<Die3D face={17} faces={20} rolling={false} durationMs={900} />)
    // A d20 at rest shows several triangular faces, not one square.
    expect(polygonCount()).toBeGreaterThan(3)
    expect(numeral()).toBe('17')
    const text = document.querySelector('text')
    expect(text?.getAttribute('transform')).toBeNull()
  })

  it('renders a numeral, not pips, for any die past six faces', () => {
    render(<Die3D face={8} faces={12} rolling={false} durationMs={900} />)
    expect(numeral()).toBe('8')
    expect(pipCount()).toBe(0)
  })

  it('hides the result while tumbling and fades it in from the final contact', () => {
    const { rerender } = render(<Die3D face={6} faces={6} rolling={false} durationMs={900} />)
    rerender(<Die3D face={6} faces={6} rolling durationMs={900} />)

    // Mid-flight (t = 0.3 after three 100ms frames): airborne, no pips yet.
    crankFrames(3)
    expect(pipCount()).toBe(0)

    // Past the final contact (t = 0.9): pips fading in.
    crankFrames(6)
    expect(pipCount()).toBe(6)

    // Landed (t = 1): fully shown, and the frame loop has stopped requeueing.
    crankFrames(1)
    expect(pipCount()).toBe(6)
    expect(frameQueue).toHaveLength(0)
  })

  it('moves the die during the roll: the transform leaves and returns to rest', () => {
    const { rerender, container } = render(
      <Die3D face={3} faces={6} rolling={false} durationMs={900} />,
    )
    const transformOf = () => container.querySelector('g')?.getAttribute('transform')
    const restTransform = transformOf()

    rerender(<Die3D face={3} faces={6} rolling durationMs={900} />)
    // The first frame only records the start timestamp (t stays 0); the second samples
    // t ~ 0.11, mid-first-arc: airborne, scaled up.
    crankFrames(2)
    expect(transformOf()).not.toBe(restTransform)

    crankFrames(9) // t = 1
    expect(transformOf()).toBe(restTransform)
  })

  it('shows more of the solid mid-tumble than at rest for a d6', () => {
    const { rerender } = render(<Die3D face={1} faces={6} rolling={false} durationMs={900} />)
    // Rest, roll-only tilt: one face, one base polygon (plus shade overlays).
    rerender(<Die3D face={1} faces={6} rolling durationMs={900} />)
    crankFrames(2) // mid-tumble at an oblique orientation
    expect(polygonCount()).toBeGreaterThan(2)
  })

  it('renders the final pose immediately under reduced motion, easing in by opacity', () => {
    setReducedMotionSource(() => true)
    const { container } = render(<Die3D face={4} faces={6} rolling durationMs={150} />)
    // No animation frames were requested at all.
    expect(frameQueue).toHaveLength(0)
    expect(pipCount()).toBe(4)
    const group = container.querySelector('g')
    expect(group?.style.opacity).toBe('0.4')
    expect(group?.style.transition).toContain('opacity')
  })

  it('cleans up its pending frame on unmount', () => {
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const { rerender, unmount } = render(
      <Die3D face={2} faces={6} rolling={false} durationMs={900} />,
    )
    rerender(<Die3D face={2} faces={6} rolling durationMs={900} />)
    unmount()
    expect(cancel).toHaveBeenCalled()
  })
})
