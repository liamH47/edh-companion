import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setComputeBackend } from '@mtg/core'
import { listCards } from '@mtg/core/api'
import App from './App'

// The card list is the app's only network call. Compute goes through the seam.
vi.mock('@mtg/core/api', () => ({ listCards: vi.fn() }))

const compute = vi.fn()
import type { CardMetadata } from '@mtg/core'


const cardA: CardMetadata = {
  id: 'card-a',
  name: 'Card A',
  rules_text: 'Rules A',
  fields: [],
  outputs: [{ name: 'total', label: 'Total', kind: 'number', short_label: null, primary: true }],
  alert: null,
}

const cardB: CardMetadata = {
  id: 'card-b',
  name: 'Card B',
  rules_text: 'Rules B',
  fields: [],
  outputs: [{ name: 'total', label: 'Total', kind: 'number', short_label: null, primary: true }],
  alert: null,
}

beforeEach(() => {
  window.history.pushState(null, '', '/')
  setComputeBackend(compute)
  compute.mockReset()
  compute.mockResolvedValue({ outputs: { total: 0 } })
})

afterEach(() => {
  localStorage.clear()
  window.history.pushState(null, '', '/')
})

describe('App', () => {
  it('shows a loading state before the card list resolves', () => {
    vi.mocked(listCards).mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error message when the card list fails to load', async () => {
    vi.mocked(listCards).mockRejectedValue(new Error('network down'))
    render(<App />)
    expect(await screen.findByText(/Failed to load cards: network down/)).toBeInTheDocument()
  })

  it('stringifies a non-Error rejection when the card list fails to load', async () => {
    vi.mocked(listCards).mockRejectedValue('network down')
    render(<App />)
    expect(await screen.findByText(/Failed to load cards: network down/)).toBeInTheDocument()
  })

  it('lands on the card picker by default, listing every card', async () => {
    vi.mocked(listCards).mockResolvedValue([cardA, cardB])
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Card A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Card B' })).toBeInTheDocument()
  })

  it('opens a card from the picker and shows its screen, hiding the tab bar', async () => {
    const user = userEvent.setup()
    vi.mocked(listCards).mockResolvedValue([cardA, cardB])
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Card A' }))

    expect(await screen.findByRole('heading', { name: 'Card A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Coin Flip' })).not.toBeInTheDocument()
  })

  it('returns to the picker via the card screen back button', async () => {
    const user = userEvent.setup()
    vi.mocked(listCards).mockResolvedValue([cardA, cardB])
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Card A' }))
    await screen.findByRole('heading', { name: 'Card A' })

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('button', { name: 'Card A' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('restores the most recently opened card directly on the next load', async () => {
    vi.mocked(listCards).mockResolvedValue([cardA, cardB])
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Card B' }))
    await screen.findByRole('heading', { name: 'Card B' })
    unmount()

    window.history.pushState(null, '', '/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Card B' })).toBeInTheDocument()
  })

  it('falls back to the picker for a deep link to an unknown card id', async () => {
    vi.mocked(listCards).mockResolvedValue([cardA, cardB])
    window.history.pushState(null, '', '/cards/does-not-exist')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Card A' })).toBeInTheDocument()
  })

  it('switches to the Coin Flip tab and back without losing the calculator', async () => {
    const user = userEvent.setup()
    vi.mocked(listCards).mockResolvedValue([cardA])
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Coin Flip' }))
    expect(screen.queryByRole('button', { name: 'Card A' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call Heads' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cards' }))
    expect(await screen.findByRole('button', { name: 'Card A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Call Heads' })).not.toBeInTheDocument()
  })

  it('opens the pairings tab and keeps the tab bar', async () => {
    const user = userEvent.setup()
    vi.mocked(listCards).mockResolvedValue([cardA])
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Pairings' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
  })

  it('runs the pairings tab even when the card API is down', async () => {
    // The whole point of keeping Swiss logic client-side: a backend outage must not
    // take the tab you need at the table down with it.
    const user = userEvent.setup()
    vi.mocked(listCards).mockRejectedValue(new Error('network down'))
    render(<App />)
    await screen.findByText(/Failed to load cards/)

    await user.click(screen.getByRole('button', { name: 'Pairings' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
    expect(screen.queryByText(/Failed to load cards/)).not.toBeInTheDocument()
  })

  it('shows the tab bar on the coin flip screen', async () => {
    const user = userEvent.setup()
    vi.mocked(listCards).mockResolvedValue([cardA])
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Coin Flip' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument())
  })
})
