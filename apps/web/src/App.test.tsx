import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARDS, resetComputeBackend, setComputeBackend } from '@mtg/core'
import App from './App'

/**
 * The app no longer fetches anything: card metadata is bundled and compute is local.
 * The loading and error states this file used to cover went with the fetch, and these
 * now run against the real generated metadata rather than stand-in cards.
 */
const compute = vi.fn()

beforeEach(() => {
  window.history.pushState(null, '', '/')
  localStorage.clear()
  compute.mockReset()
  compute.mockReturnValue({ total: 0 })
  setComputeBackend(compute)
})

afterEach(() => {
  resetComputeBackend()
  localStorage.clear()
  window.history.pushState(null, '', '/')
})

describe('App', () => {
  it('lands on the card picker, listing every card the app ships with', () => {
    render(<App />)

    for (const card of CARDS) {
      expect(screen.getByRole('button', { name: card.name })).toBeInTheDocument()
    }
  })

  it('needs no network to show the card list', () => {
    // The point of bundling the metadata: the Cards tab used to need a connection to
    // display anything at all.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByRole('button', { name: 'Kalonian Hydra' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('opens a card from the picker and hides the tab bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Kalonian Hydra' }))

    expect(screen.getByRole('heading', { name: 'Kalonian Hydra' })).toBeInTheDocument()
    // The card screen owns the thumb zone, so the tab bar steps aside.
    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument()
  })

  it('returns to the picker via the card screen back button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Kalonian Hydra' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('restores the most recently opened card directly on the next load', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Grapeshot' }))
    first.unmount()

    window.history.pushState(null, '', '/')
    render(<App />)

    // One fewer tap at the table, which is the whole point of remembering.
    expect(screen.getByRole('heading', { name: 'Grapeshot' })).toBeInTheDocument()
  })

  it('falls back to the picker for a card id that no longer exists', () => {
    window.history.pushState(null, '', '/cards/not-a-real-card')
    render(<App />)

    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toBeInTheDocument()
  })

  it('opens the coin flip tab and keeps the tab bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Coin Flip' }))

    // Opens on the plain flip by default, not the commander experience.
    expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('opens the dice tab and keeps the tab bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Dice' }))

    expect(screen.getByRole('radiogroup', { name: 'Dice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('opens the pairings tab and keeps the tab bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Pairings' }))

    // The tab opens on the pods/Swiss chooser rather than straight into Swiss setup.
    expect(screen.getByRole('heading', { name: 'Pairings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commander pods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('switches to Coin Flip and back to the card picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Coin Flip' }))
    await user.click(screen.getByRole('button', { name: 'Cards' }))

    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toBeInTheDocument()
  })
})
