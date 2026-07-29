import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as coin from './coin'
import { CoinFlip } from './CoinFlip'
import * as sound from './sound'

vi.mock('./coin')
vi.mock('./sound')

function mockPrefersReducedMotion(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

function callHeads() {
  fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
}

function callTails() {
  fireEvent.click(screen.getByRole('button', { name: 'Call Tails' }))
}

function advance(ms = 900) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('CoinFlip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPrefersReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts at Okaun base power with all counters at zero', () => {
    render(<CoinFlip />)
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByText('Wins').previousSibling).toHaveTextContent('0')
    expect(screen.getByText('Losses').previousSibling).toHaveTextContent('0')
    expect(screen.getByText('Total').previousSibling).toHaveTextContent('0')
    expect(screen.queryByText(/^Called /)).not.toBeInTheDocument()
  })

  it('records a win, doubles Okaun, and plays the win sound when the call matches', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('heads')
    render(<CoinFlip />)

    callHeads()
    expect(screen.getByRole('button', { name: 'Call Heads' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Call Tails' })).toBeDisabled()

    advance()

    expect(screen.getByText('Heads!')).toBeInTheDocument()
    expect(screen.getByText(/Called heads — Win!/)).toBeInTheDocument()
    expect(screen.getByText('6/6')).toBeInTheDocument()
    expect(screen.getByText('Wins').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Losses').previousSibling).toHaveTextContent('0')
    expect(screen.getByText('Total').previousSibling).toHaveTextContent('1')
    expect(sound.playWinSound).toHaveBeenCalledTimes(1)
    expect(sound.playLoseSound).not.toHaveBeenCalled()
  })

  it('records a loss and plays the lose sound when the call misses', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('tails')
    render(<CoinFlip />)

    callHeads()
    advance()

    expect(screen.getByText('Tails!')).toBeInTheDocument()
    expect(screen.getByText(/Called heads — Loss/)).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByText('Wins').previousSibling).toHaveTextContent('0')
    expect(screen.getByText('Losses').previousSibling).toHaveTextContent('1')
    expect(sound.playLoseSound).toHaveBeenCalledTimes(1)
    expect(sound.playWinSound).not.toHaveBeenCalled()
  })

  it('compounds Okaun power across multiple wins', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('tails')
    render(<CoinFlip />)

    callTails()
    advance()
    expect(screen.getByText('6/6')).toBeInTheDocument()

    callTails()
    advance()
    expect(screen.getByText('12/12')).toBeInTheDocument()
    expect(screen.getByText('Wins').previousSibling).toHaveTextContent('2')
  })

  it('resets counters, power, and result on "New Turn"', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('heads')
    render(<CoinFlip />)

    callHeads()
    advance()
    expect(screen.getByText('6/6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New Turn' }))

    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByText('Wins').previousSibling).toHaveTextContent('0')
    expect(screen.getByText('Total').previousSibling).toHaveTextContent('0')
    expect(screen.queryByText(/^Called /)).not.toBeInTheDocument()
  })

  it('discards an in-flight flip when "New Turn" is clicked mid-animation', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('heads')
    render(<CoinFlip />)

    callHeads()
    fireEvent.click(screen.getByRole('button', { name: 'New Turn' }))
    advance()

    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByText('Total').previousSibling).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'Call Heads' })).toBeEnabled()
    expect(sound.playWinSound).not.toHaveBeenCalled()
  })

  it('resolves faster when the user prefers reduced motion', () => {
    mockPrefersReducedMotion(true)
    vi.mocked(coin.flipCoin).mockReturnValue('heads')
    render(<CoinFlip />)

    callHeads()
    advance(150)

    expect(screen.getByText('Heads!')).toBeInTheDocument()
  })

  it('cleans up a pending flip timeout on unmount without throwing or firing sound', () => {
    vi.mocked(coin.flipCoin).mockReturnValue('heads')
    const { unmount } = render(<CoinFlip />)

    callHeads()
    unmount()

    expect(() => advance()).not.toThrow()
    expect(sound.playWinSound).not.toHaveBeenCalled()
  })

  it('unmounts cleanly when no flip was ever started', () => {
    const { unmount } = render(<CoinFlip />)
    expect(() => unmount()).not.toThrow()
  })
})
