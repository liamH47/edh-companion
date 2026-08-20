import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CardMetadata } from '@mtg/core'
import { CardDetailSheet } from './CardDetailSheet'

function makeCard(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'aetherflux-reservoir',
    name: 'Aetherflux Reservoir',
    rules_text: 'Whenever you cast a spell, you gain 1 life.',
    scryfall_id: '96b6b2e1-c3e6-464c-8a13-b15deb34e862',
    show_hero_art: false,
    fields: [],
    outputs: [],
    alert: null,
    ...overrides,
  }
}

describe('CardDetailSheet', () => {
  it('renders nothing when closed', () => {
    render(<CardDetailSheet open={false} onClose={() => {}} card={makeCard()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the card image and its Oracle text when open', () => {
    render(<CardDetailSheet open onClose={() => {}} card={makeCard()} />)

    expect(screen.getByRole('dialog', { name: 'Aetherflux Reservoir' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Aetherflux Reservoir, as printed' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Whenever you cast a spell, you gain 1 life.')).toBeInTheDocument()
  })

  it('still shows the Oracle text for a card with no image', () => {
    // The text is the half that survives with no network, which is why it renders as
    // real text under the image rather than being replaced by it.
    render(<CardDetailSheet open onClose={() => {}} card={makeCard({ scryfall_id: null })} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Whenever you cast a spell, you gain 1 life.')).toBeInTheDocument()
  })
})
