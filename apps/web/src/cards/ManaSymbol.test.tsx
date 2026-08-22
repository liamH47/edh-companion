import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mana } from '@mtg/core/theme/tokens'
import { ManaSymbol } from './ManaSymbol'

describe('ManaSymbol', () => {
  it('draws a disc in that color, with its glyph on top', () => {
    const { container } = render(<ManaSymbol color="G" />)
    const disc = container.querySelector('circle')!
    // The token, not a literal -- a raw hex here would be a design value living only
    // in JSX, which is what the token layer exists to prevent.
    expect(disc.getAttribute('fill')).toBe('var(--mana-g)')
    expect(container.querySelector('g')!.getAttribute('fill')).toBe('var(--mana-glyph)')
  })

  it('has a distinct glyph for every color, so hue is never the only cue', () => {
    // Colorblind players read the shape; a shared glyph would leave them nothing.
    const shapes = (['W', 'U', 'B', 'R', 'G', 'C'] as const).map((color) => {
      const { container } = render(<ManaSymbol color={color} />)
      // Everything inside the glyph group, disc excluded.
      return container.querySelector('g')!.innerHTML
    })
    expect(new Set(shapes).size).toBe(6)
  })

  it('covers every color the tokens declare', () => {
    // A token added without a glyph would render an empty disc rather than fail.
    for (const color of Object.keys(mana) as (keyof typeof mana)[]) {
      const { container } = render(<ManaSymbol color={color} />)
      expect(container.querySelector('g')!.innerHTML).not.toBe('')
    }
  })

  it('dims a color that is not in the pool', () => {
    const { container } = render(<ManaSymbol color="G" dimmed />)
    expect(container.querySelector('svg')!.style.opacity).toBe('0.35')
  })

  it('is undimmed and decorative by default', () => {
    const { container } = render(<ManaSymbol color="G" size={24} />)
    const svg = container.querySelector('svg')!
    expect(svg.style.opacity).toBe('')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('24')
  })
})
