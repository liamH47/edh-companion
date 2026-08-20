import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CardMetadata } from '@mtg/core'
import { CardArtHero } from './CardArtHero'

function makeCard(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'comet-like',
    name: 'Comet-Like',
    rules_text: '...',
    scryfall_id: '96b6b2e1-c3e6-464c-8a13-b15deb34e862',
    show_hero_art: true,
    fields: [],
    outputs: [],
    alert: null,
    ...overrides,
  }
}

describe('CardArtHero', () => {
  it('renders the card large with the live loyalty over the printed loyalty box', () => {
    render(<CardArtHero card={makeCard()} label="loyalty" value={7} pending={false} dead={false} />)
    expect(screen.getByAltText('Comet-Like, as printed')).toBeInTheDocument()
    // The badge overlays the image: it lives inside the art container.
    const hero = screen.getByTestId('card-art-hero')
    expect(hero.querySelector('[data-testid="loyalty-shield"]')).not.toBeNull()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
  })

  it('dims the badge, not the art, while a recalculation is pending', () => {
    render(<CardArtHero card={makeCard()} label="loyalty" value={7} pending dead={false} />)
    expect(screen.getByTestId('loyalty-shield').className).toContain('opacity-60')
  })

  it('falls back to the standalone shield when the image fails to load', () => {
    render(<CardArtHero card={makeCard()} label="loyalty" value={4} pending={false} dead={false} />)
    fireEvent.error(screen.getByAltText('Comet-Like, as printed'))
    // No art container anymore -- the game state never waits on the network.
    expect(screen.queryByTestId('card-art-hero')).not.toBeInTheDocument()
    expect(screen.getByTestId('loyalty-shield')).toBeInTheDocument()
    expect(screen.getByText('loyalty')).toBeInTheDocument()
  })

  it('renders the standalone shield for an entry with no card behind it', () => {
    render(
      <CardArtHero
        card={makeCard({ scryfall_id: null })}
        label="loyalty"
        value={2}
        pending={false}
        dead={false}
      />,
    )
    expect(screen.queryByTestId('card-art-hero')).not.toBeInTheDocument()
    expect(screen.getByTestId('loyalty-shield')).toBeInTheDocument()
  })
})
