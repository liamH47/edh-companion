import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as coin from '@mtg/core'
import { setReducedMotionSource, setSoundBackend } from '@mtg/core'
import { CoinFlip } from './CoinFlip'

vi.mock('@mtg/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mtg/core')>()),
  flipCoin: vi.fn(),
}))

/**
 * Sound goes through the real seam rather than a mocked module: registering a spy
 * backend exercises the same path production takes, including the enabled check.
 */
const sound = { playWin: vi.fn(), playLose: vi.fn(), playRoll: vi.fn() }

function mockPrefersReducedMotion(matches: boolean) {
  setReducedMotionSource(() => matches)
}

function goToCommanderMode() {
  fireEvent.click(screen.getByRole('button', { name: 'Commander' }))
}

function advance(ms = 900) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('CoinFlip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    coin.resetStorageBackend()
    mockPrefersReducedMotion(false)
    sound.playWin.mockClear()
    sound.playLose.mockClear()
    setSoundBackend(sound)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('plain mode (default)', () => {
    it('shows just a Flip button, with none of the commander furniture', () => {
      render(<CoinFlip />)
      expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Call Heads' })).not.toBeInTheDocument()
      expect(screen.queryByText('3/3')).not.toBeInTheDocument()
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
    })

    it('flips to Heads and reveals it only once the coin lands', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      expect(screen.getByRole('button', { name: 'Flipping…' })).toBeDisabled()
      expect(screen.queryByText('Heads!')).not.toBeInTheDocument()

      advance()
      expect(screen.getByText('Heads!')).toBeInTheDocument()
      // No win/loss meaning in plain mode, so nothing sounds.
      expect(sound.playWin).not.toHaveBeenCalled()
      expect(sound.playLose).not.toHaveBeenCalled()
    })

    it('flips to Tails', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('tails')
      render(<CoinFlip />)

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      advance()
      expect(screen.getByText('Tails!')).toBeInTheDocument()
    })

    it('hides the previous result while a new flip is in the air', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      advance()
      expect(screen.getByText('Heads!')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      expect(screen.queryByText('Heads!')).not.toBeInTheDocument()

      advance()
      expect(screen.getByText('Heads!')).toBeInTheDocument()
    })

    it('ignores a same-frame double tap, starting only one flip', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      const button = screen.getByRole('button', { name: 'Flip' })

      // Two clicks before React re-renders (and disables the button): the ref guard, not
      // the disabled attribute, is what stops the second flip here.
      act(() => {
        button.click()
        button.click()
      })
      expect(coin.flipCoin).toHaveBeenCalledTimes(1)
    })

    it('reveals faster when the player prefers reduced motion', () => {
      mockPrefersReducedMotion(true)
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      advance(150)
      expect(screen.getByText('Heads!')).toBeInTheDocument()
    })

    it('cleans up a pending flip on unmount without throwing', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      const { unmount } = render(<CoinFlip />)

      fireEvent.click(screen.getByRole('button', { name: 'Flip' }))
      unmount()
      expect(() => advance()).not.toThrow()
    })
  })

  describe('commander mode', () => {
    it('is reachable via the toggle and shows the Okaun tracker at base', () => {
      render(<CoinFlip />)
      goToCommanderMode()

      expect(screen.getByText('3/3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Call Heads' })).toBeInTheDocument()
      expect(screen.getByText('Wins').previousSibling).toHaveTextContent('0')
    })

    it('records a win, doubles Okaun, and plays the win sound when the call matches', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
      advance()

      expect(screen.getByText('Heads!')).toBeInTheDocument()
      expect(screen.getByText(/Called heads — Win!/)).toBeInTheDocument()
      expect(screen.getByText('6/6')).toBeInTheDocument()
      expect(screen.getByText('Wins').previousSibling).toHaveTextContent('1')
      expect(sound.playWin).toHaveBeenCalledTimes(1)
      expect(sound.playLose).not.toHaveBeenCalled()
    })

    it('records a loss and plays the lose sound when the call misses', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('tails')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
      advance()

      expect(screen.getByText('Tails!')).toBeInTheDocument()
      expect(screen.getByText(/Called heads — Loss/)).toBeInTheDocument()
      expect(screen.getByText('Losses').previousSibling).toHaveTextContent('1')
      expect(sound.playLose).toHaveBeenCalledTimes(1)
      expect(sound.playWin).not.toHaveBeenCalled()
    })

    it('compounds Okaun power across multiple wins', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('tails')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Tails' }))
      advance()
      expect(screen.getByText('6/6')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Call Tails' }))
      advance()
      expect(screen.getByText('12/12')).toBeInTheDocument()
      expect(screen.getByText('Wins').previousSibling).toHaveTextContent('2')
    })

    it('resets counters, power, and result on "New Turn"', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
      advance()
      expect(screen.getByText('6/6')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'New Turn' }))
      expect(screen.getByText('3/3')).toBeInTheDocument()
      expect(screen.getByText('Total').previousSibling).toHaveTextContent('0')
      expect(screen.queryByText(/^Called /)).not.toBeInTheDocument()
    })

    it('discards an in-flight flip when "New Turn" is clicked mid-animation', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
      fireEvent.click(screen.getByRole('button', { name: 'New Turn' }))
      advance()

      expect(screen.getByText('3/3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Call Heads' })).toBeEnabled()
      expect(sound.playWin).not.toHaveBeenCalled()
    })

    it('ignores a same-frame double call, flipping only once', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      goToCommanderMode()
      const button = screen.getByRole('button', { name: 'Call Heads' })

      act(() => {
        button.click()
        button.click()
      })
      expect(coin.flipCoin).toHaveBeenCalledTimes(1)
    })

    it('cleans up a pending flip on unmount without firing sound', () => {
      vi.mocked(coin.flipCoin).mockReturnValue('heads')
      render(<CoinFlip />)
      goToCommanderMode()

      fireEvent.click(screen.getByRole('button', { name: 'Call Heads' }))
      // Switching back to plain unmounts the commander coin mid-flip.
      fireEvent.click(screen.getByRole('button', { name: 'Plain' }))
      expect(() => advance()).not.toThrow()
      expect(sound.playWin).not.toHaveBeenCalled()
    })
  })

  describe('mode persistence', () => {
    it('remembers commander mode across mounts, and switching back', () => {
      const first = render(<CoinFlip />)
      goToCommanderMode()
      expect(coin.isCommanderModeEnabled()).toBe(true)
      first.unmount()

      const second = render(<CoinFlip />)
      expect(screen.getByRole('button', { name: 'Call Heads' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Plain' }))
      expect(coin.isCommanderModeEnabled()).toBe(false)
      expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument()
      second.unmount()
    })
  })
})
