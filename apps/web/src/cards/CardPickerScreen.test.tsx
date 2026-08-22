import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordCardOpened } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { CardPickerScreen } from './CardPickerScreen'

function makeCard(id: string, name: string, scryfallId: string | null = null): CardMetadata {
  return {
    id,
    name,
    rules_text: '...',
    scryfall_id: scryfallId,
    show_hero_art: false,
    resets_on_new_turn: true,
    fields: [],
    outputs: [],
    alert: null,
  }
}

const cards = [
  makeCard('aetherflux-reservoir', 'Aetherflux Reservoir'),
  makeCard('craterhoof-behemoth', 'Craterhoof Behemoth'),
]

afterEach(() => {
  localStorage.clear()
})

describe('CardPickerScreen', () => {
  it('lists every card by default', () => {
    render(<CardPickerScreen cards={cards} onSelectCard={() => {}} />)
    expect(screen.getByRole('button', { name: 'Aetherflux Reservoir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Craterhoof Behemoth' })).toBeInTheDocument()
  })

  it('orders most-recently-opened cards first', () => {
    recordCardOpened('craterhoof-behemoth')
    render(<CardPickerScreen cards={cards} onSelectCard={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Craterhoof Behemoth')
    expect(buttons[1]).toHaveTextContent('Aetherflux Reservoir')
  })

  it('filters by search query, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<CardPickerScreen cards={cards} onSelectCard={() => {}} />)
    await user.type(screen.getByLabelText('Search cards'), 'crater')
    expect(screen.getByRole('button', { name: 'Craterhoof Behemoth' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aetherflux Reservoir' })).not.toBeInTheDocument()
  })

  it('shows a no-results message for a query that matches nothing', async () => {
    const user = userEvent.setup()
    render(<CardPickerScreen cards={cards} onSelectCard={() => {}} />)
    await user.type(screen.getByLabelText('Search cards'), 'zzz')
    expect(screen.getByText('No cards match "zzz".')).toBeInTheDocument()
  })

  it('calls onSelectCard with the tapped card id', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    render(<CardPickerScreen cards={cards} onSelectCard={onSelectCard} />)
    await user.click(screen.getByRole('button', { name: 'Aetherflux Reservoir' }))
    expect(onSelectCard).toHaveBeenCalledWith('aetherflux-reservoir')
  })

  it('shows a card thumbnail for entries with a printed card', () => {
    const arted = [makeCard('kalonian-hydra', 'Kalonian Hydra', '1d21ae20-2ef5-4dc0-aced-97497e6a8025')]
    render(<CardPickerScreen cards={arted} onSelectCard={() => {}} />)
    // Decorative (alt="") -- the name is right beside it -- so query by tag.
    const img = document.querySelector('img')!
    expect(img.src).toContain('1d21ae20-2ef5-4dc0-aced-97497e6a8025')
    expect(img.src).toContain('version=small')
    expect(screen.queryByTestId('card-thumb-fallback')).not.toBeInTheDocument()
  })

  it('falls back to the card-back tile for cardless entries and failed loads', () => {
    const mixed = [
      makeCard('commander-tax', 'Commander Tax'),
      makeCard('kalonian-hydra', 'Kalonian Hydra', '1d21ae20-2ef5-4dc0-aced-97497e6a8025'),
    ]
    render(<CardPickerScreen cards={mixed} onSelectCard={() => {}} />)
    // Commander Tax has no printed card: tile from the start.
    expect(screen.getAllByTestId('card-thumb-fallback')).toHaveLength(1)
    // Kalonian Hydra's image dies (offline): its row degrades to the same tile.
    fireEvent.error(document.querySelector('img')!)
    expect(screen.getAllByTestId('card-thumb-fallback')).toHaveLength(2)
    expect(document.querySelector('img')).toBeNull()
  })
})
