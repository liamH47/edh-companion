import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStorageBackend, setReducedMotionSource, setSoundBackend } from '@mtg/core'
import { DiceScreen } from './DiceScreen'

const sound = { playWin: vi.fn(), playLose: vi.fn(), playRoll: vi.fn() }

/** An rng that hands back a fixed sequence, so a roll lands on exact faces. */
function queuedRng(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

function advance(ms = 900) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function pressRoll() {
  fireEvent.click(screen.getByRole('button', { name: /Roll$|Rolling/ }))
}

function chooseMode(label: string) {
  fireEvent.click(screen.getByRole('radio', { name: label }))
}

describe('DiceScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStorageBackend()
    setReducedMotionSource(() => false)
    sound.playRoll.mockClear()
    sound.playLose.mockClear()
    setSoundBackend(sound)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts on d6 with a single die and a Roll button', () => {
    render(<DiceScreen />)
    expect(screen.getByRole('radio', { name: 'd6' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument()
    expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(1)
  })

  it('rolls a d6, announcing the face and playing the neutral roll sound', () => {
    // 0.5 * 6 = 3, +1 -> 4. A plain d6 is never a "failure", even on a 1.
    render(<DiceScreen rng={queuedRng([0.5])} />)
    pressRoll()
    expect(screen.getByRole('button', { name: 'Rolling…' })).toBeDisabled()

    advance()
    expect(screen.getByText('Rolled 4')).toBeInTheDocument()
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
    expect(sound.playLose).not.toHaveBeenCalled()
  })

  it('does not treat a 1 on a plain d6 as a failure', () => {
    render(<DiceScreen rng={queuedRng([0])} />)
    pressRoll()
    advance()
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
    expect(sound.playLose).not.toHaveBeenCalled()
  })

  it('rolls 2d6, showing a visible sum and one combined announcement', () => {
    render(<DiceScreen rng={queuedRng([0, 0.99])} />) // -> [1, 6]
    chooseMode('2d6')
    expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(2)

    pressRoll()
    advance()

    expect(screen.getByText('Rolled 1 and 6 — sum 7')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('1 + 6')).toBeInTheDocument()
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
    expect(sound.playLose).not.toHaveBeenCalled()
  })

  it('plays the loss sound on 2d6 snake eyes', () => {
    render(<DiceScreen rng={queuedRng([0])} />) // both dice -> 1
    chooseMode('2d6')
    pressRoll()
    advance()

    expect(screen.getByText('Rolled 1 and 1 — sum 2')).toBeInTheDocument()
    // The roll clip is the physics (the dice still audibly land); the sting is the
    // outcome. Both play on a failure.
    expect(sound.playLose).toHaveBeenCalledTimes(1)
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
  })

  it('rolls a d20 as a numeral and plays the loss sound on a natural 1', () => {
    render(<DiceScreen rng={queuedRng([0])} />) // -> 1
    chooseMode('d20')
    pressRoll()
    advance()

    expect(screen.getByText('Rolled 1')).toBeInTheDocument()
    expect(sound.playLose).toHaveBeenCalledTimes(1)
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
  })

  it('plays the neutral roll sound on a d20 that is not a 1', () => {
    render(<DiceScreen rng={queuedRng([0.5])} />) // 0.5 * 20 = 10, +1 -> 11
    chooseMode('d20')
    pressRoll()
    advance()

    expect(screen.getByText('Rolled 11')).toBeInTheDocument()
    expect(sound.playRoll).toHaveBeenCalledTimes(1)
    expect(sound.playLose).not.toHaveBeenCalled()
  })

  it('disables the mode selector while rolling', () => {
    render(<DiceScreen rng={queuedRng([0.5])} />)
    pressRoll()
    expect(screen.getByRole('radio', { name: '2d6' })).toBeDisabled()

    advance()
    expect(screen.getByRole('radio', { name: '2d6' })).toBeEnabled()
  })

  it('clears the previous result when the mode changes', () => {
    render(<DiceScreen rng={queuedRng([0, 0.99])} />)
    chooseMode('2d6')
    pressRoll()
    advance()
    expect(screen.getByText('1 + 6')).toBeInTheDocument()

    chooseMode('d6')
    expect(screen.queryByText('1 + 6')).not.toBeInTheDocument()
  })

  it('shows no sum at all before the first 2d6 roll -- never a fabricated snake eyes', () => {
    // The sum slot is always mounted so the Roll button cannot jump 71px on every roll,
    // but its *contents* stay guarded: changeMode reseeds both dice to face 1, so an
    // unguarded slot would flash "2" / "1 + 1" the instant you switch to 2d6 -- a result
    // nobody rolled. The older "previous result is cleared" test above cannot catch this,
    // since it only looks for '1 + 6'.
    render(<DiceScreen rng={queuedRng([0, 0.99])} />)
    chooseMode('2d6')

    expect(screen.queryByText('1 + 1')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('reserves the sum slot in every mode, so the Roll button never moves', () => {
    // The slot's reason for existing: mounting it only once a result existed moved the
    // Roll button 71px out from under the thumb on every roll.
    render(<DiceScreen rng={queuedRng([0, 0.99])} />)
    expect(screen.getByTestId('sum-slot')).toBeInTheDocument() // d6: reserved but empty

    chooseMode('2d6')
    expect(screen.getByTestId('sum-slot')).toBeEmptyDOMElement()

    pressRoll()
    advance()

    // Same element, now filled -- nothing above the button was added or removed.
    expect(screen.getByTestId('sum-slot')).toHaveTextContent('1 + 6')
  })

  it('ignores a same-frame double tap, rolling only once', () => {
    const rng = vi.fn(() => 0.5)
    render(<DiceScreen rng={rng} />)
    const button = screen.getByRole('button', { name: 'Roll' })

    act(() => {
      button.click()
      button.click()
    })
    // One d6 = one face draw plus one tumble seed; the second tap is guarded before it can start a second roll.
    expect(rng).toHaveBeenCalledTimes(2)
  })

  it('lands quickly under reduced motion', () => {
    setReducedMotionSource(() => true)
    render(<DiceScreen rng={queuedRng([0.5])} />)
    pressRoll()
    advance(150)
    expect(screen.getByText('Rolled 4')).toBeInTheDocument()
  })

  it('cleans up a pending roll on unmount without throwing or sounding', () => {
    const { unmount } = render(<DiceScreen rng={queuedRng([0.5])} />)
    pressRoll()
    unmount()
    expect(() => advance()).not.toThrow()
    expect(sound.playRoll).not.toHaveBeenCalled()
  })
})
