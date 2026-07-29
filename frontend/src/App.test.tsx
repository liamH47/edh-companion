import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './api'
import type { CardMetadata } from './types'

vi.mock('./api')

const cardA: CardMetadata = {
  id: 'card-a',
  name: 'Card A',
  rules_text: 'Rules A',
  fields: [],
  outputs: [],
}

const cardB: CardMetadata = {
  id: 'card-b',
  name: 'Card B',
  rules_text: 'Rules B',
  fields: [],
  outputs: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.calculateCard).mockResolvedValue({ outputs: {} })
  })

  it('shows a loading state before the card list resolves', () => {
    vi.mocked(api.listCards).mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders a single card without a card selector', async () => {
    vi.mocked(api.listCards).mockResolvedValue([cardA])
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Card A' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Card')).not.toBeInTheDocument()
  })

  it('shows a card selector and switches cards when more than one is registered', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listCards).mockResolvedValue([cardA, cardB])
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Card A' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Card'), 'card-b')
    expect(await screen.findByRole('heading', { name: 'Card B' })).toBeInTheDocument()
  })

  it('shows an error message when the card list fails to load', async () => {
    vi.mocked(api.listCards).mockRejectedValue(new Error('network down'))
    render(<App />)
    expect(await screen.findByText(/Failed to load cards: network down/)).toBeInTheDocument()
  })

  it('stringifies a non-Error rejection when the card list fails to load', async () => {
    vi.mocked(api.listCards).mockRejectedValue('network down')
    render(<App />)
    expect(await screen.findByText(/Failed to load cards: network down/)).toBeInTheDocument()
  })

  it('keeps showing the loading state if the card list resolves empty', async () => {
    vi.mocked(api.listCards).mockResolvedValue([])
    render(<App />)
    await waitFor(() => expect(api.listCards).toHaveBeenCalled())
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('switches to the Coin Flip tab and back without losing the calculator', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listCards).mockResolvedValue([cardA])
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Card A' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Coin Flip' }))
    expect(screen.queryByRole('heading', { name: 'Card A' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call Heads' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Aetherflux' }))
    expect(screen.getByRole('heading', { name: 'Card A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Call Heads' })).not.toBeInTheDocument()
  })
})
