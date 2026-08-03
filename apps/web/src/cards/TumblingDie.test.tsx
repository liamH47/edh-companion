import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TumblingDie } from './TumblingDie'

function pipCount() {
  return document.querySelectorAll('circle').length
}

function numeral() {
  return document.querySelector('text')?.textContent
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('TumblingDie', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the settled face as pips for a d6', () => {
    render(<TumblingDie face={4} faces={6} rolling={false} durationMs={900} />)
    expect(pipCount()).toBe(4)
  })

  it('renders a numeral instead of pips for a die larger than a d6', () => {
    render(<TumblingDie face={20} faces={20} rolling={false} durationMs={900} />)
    expect(numeral()).toBe('20')
    expect(pipCount()).toBe(0)
  })

  it('falls back to a numeral if asked for a face a d6 has no pip layout for', () => {
    // The 2d6-sum-in-one-die trap: a sum of 7-12 has no pip layout, so render the
    // number rather than crashing on a missing entry.
    render(<TumblingDie face={9} faces={6} rolling={false} durationMs={900} />)
    expect(numeral()).toBe('9')
    expect(pipCount()).toBe(0)
  })

  it('flickers through faces while rolling, then settles on the target face', () => {
    const { rerender } = render(
      <TumblingDie face={1} faces={6} rolling={false} durationMs={900} />,
    )
    expect(pipCount()).toBe(1)

    // Parent decides the outcome up front and starts the roll.
    rerender(<TumblingDie face={5} faces={6} rolling={true} durationMs={900} />)
    advance(140) // two flicker intervals
    // The flicker is showing something other than the settled face.
    expect(pipCount()).not.toBe(5)

    // Parent ends the roll, revealing the chosen face.
    rerender(<TumblingDie face={5} faces={6} rolling={false} durationMs={900} />)
    expect(pipCount()).toBe(5)
  })

  it('does not leak timers when unmounted mid-roll', () => {
    const { rerender, unmount } = render(
      <TumblingDie face={1} faces={6} rolling={false} durationMs={900} />,
    )
    rerender(<TumblingDie face={3} faces={6} rolling={true} durationMs={900} />)
    advance(70)

    unmount()
    expect(() => advance(900)).not.toThrow()
  })
})
