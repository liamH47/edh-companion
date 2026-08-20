import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CardMetadata } from '@mtg/core'
import { CardImage } from './CardImage'

const SCRYFALL_ID = '1d21ae20-2ef5-4dc0-aced-97497e6a8025'

function makeCard(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'kalonian-hydra',
    name: 'Kalonian Hydra',
    rules_text: 'Trample',
    scryfall_id: SCRYFALL_ID,
    show_hero_art: false,
    resets_on_new_turn: true,
    fields: [],
    outputs: [],
    alert: null,
    ...overrides,
  }
}

describe('CardImage', () => {
  it('renders the printed card image', () => {
    render(<CardImage card={makeCard()} />)
    const image = screen.getByRole('img', { name: 'Kalonian Hydra, as printed' })
    expect(image).toHaveAttribute('src', expect.stringContaining(SCRYFALL_ID))
  })

  it('contains the image rather than stretching it', () => {
    // Scryfall's terms forbid distorting card images, so this is a rule rather than a
    // style preference -- object-contain inside a fixed 488x680 box is what enforces it.
    render(<CardImage card={makeCard()} />)
    expect(screen.getByRole('img')).toHaveClass('object-contain')
  })

  it('falls back to a note when the image fails to load', () => {
    // The offline case. Everything else in the app works without a network, so a failed
    // image has to read as "no picture today" rather than a broken screen.
    render(<CardImage card={makeCard()} />)
    fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/needs a connection/i)).toBeInTheDocument()
  })

  it('renders the note instead of a broken image when the card has no Scryfall id', () => {
    render(<CardImage card={makeCard({ scryfall_id: null })} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/needs a connection/i)).toBeInTheDocument()
  })
})
