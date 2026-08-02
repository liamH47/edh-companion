import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DieRoller } from './DieRoller'

/**
 * fireEvent + act rather than userEvent, matching CoinFlip.test.tsx -- the other
 * timer-driven animation in this app. userEvent awaits real timers between events,
 * which never resolve once the clock is faked, so every interaction hangs.
 */
const TUMBLE_MS = 900

function setup(overrides: Partial<Parameters<typeof DieRoller>[0]> = {}) {
  const onRolled = vi.fn()
  const view = render(
    <DieRoller
      faces={6}
      actionLabel="Roll the die"
      disabled={false}
      onRolled={onRolled}
      // 0.5 * 6 = 3, +1 -> lands on 4.
      rng={() => 0.5}
      {...overrides}
    />,
  )
  return { onRolled, ...view }
}

function pressRoll() {
  fireEvent.click(screen.getByRole('button', { name: /Roll the die|Rolling/ }))
}

function advance(ms = TUMBLE_MS) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function pipCount() {
  return document.querySelectorAll('circle').length
}

describe('DieRoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports the rolled face only once the tumble finishes', () => {
    const { onRolled } = setup()

    pressRoll()

    // Mid-roll the result is still withheld -- the die is visibly tumbling.
    expect(onRolled).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rolling…' })).toBeDisabled()

    advance()

    expect(onRolled).toHaveBeenCalledTimes(1)
    expect(onRolled).toHaveBeenCalledWith(4)
    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeEnabled()
  })

  it('announces the landed face to a screen reader, and nothing mid-roll', () => {
    setup()
    pressRoll()

    expect(screen.queryByText(/^Rolled /)).not.toBeInTheDocument()

    advance()

    expect(screen.getByText('Rolled 4')).toBeInTheDocument()
  })

  it('decides the result up front rather than when the timer fires', () => {
    // Consumed once, at the press. Choosing at the end would let the flicker interval
    // or a reduced-motion setting influence the outcome.
    const rng = vi.fn().mockReturnValue(0)
    const { onRolled } = setup({ rng })

    pressRoll()
    expect(rng).toHaveBeenCalledTimes(1)

    advance()
    expect(onRolled).toHaveBeenCalledWith(1)
  })

  it('never rolls below 1', () => {
    const { onRolled } = setup({ rng: () => 0 })
    pressRoll()
    advance()
    expect(onRolled).toHaveBeenCalledWith(1)
  })

  it('never rolls above the face count', () => {
    // Math.random() returns values arbitrarily close to 1 but never 1 itself.
    const { onRolled } = setup({ rng: () => 0.999999 })
    pressRoll()
    advance()
    expect(onRolled).toHaveBeenCalledWith(6)
  })

  it('cycles the shown face while tumbling, then settles on the result', () => {
    setup()
    expect(pipCount()).toBe(1)

    pressRoll()
    advance(140) // two flicker intervals
    expect(pipCount()).toBeGreaterThan(1)

    advance()
    expect(pipCount()).toBe(4)
  })

  it('can be rolled again after it lands', () => {
    const { onRolled } = setup()

    pressRoll()
    advance()
    pressRoll()
    advance()

    expect(onRolled).toHaveBeenCalledTimes(2)
  })

  it('cannot be rolled while disabled, and says why', () => {
    setup({ disabled: true })

    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeDisabled()
    expect(screen.getByText('No activations left this turn.')).toBeInTheDocument()
  })

  it('renders a number instead of pips for a die larger than a d6', () => {
    setup({ faces: 20 })
    expect(document.querySelector('text')?.textContent).toBe('1')
    expect(pipCount()).toBe(0)
  })

  it('lands quickly when the player asks for reduced motion', () => {
    // Same result, far less tumbling: a vestibular-sensitive player should not have to
    // sit through 900ms of spin to find out what they rolled.
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )

    const { onRolled } = setup()
    pressRoll()

    advance(150)
    expect(onRolled).toHaveBeenCalledWith(4)
  })

  it('does not report a roll that was unmounted mid-tumble', () => {
    // Leaving the card mid-roll must not append a roll to a session that is gone.
    const { onRolled, unmount } = setup()
    pressRoll()

    unmount()
    advance()

    expect(onRolled).not.toHaveBeenCalled()
  })
})
