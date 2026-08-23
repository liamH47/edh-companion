import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EntrantBadge } from './EntrantBadge'

describe('EntrantBadge', () => {
  it('renders the uppercased first letter of a given name', () => {
    render(<EntrantBadge name="mira" />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('falls back to "?" for a name with no visible characters', () => {
    render(<EntrantBadge name="   " />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders a decorative group glyph, not a letter, when no name is given', () => {
    const { container } = render(<EntrantBadge />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.textContent).toBe('')
  })

  it('is decorative -- hidden from the accessibility tree either way', () => {
    const { container: withName } = render(<EntrantBadge name="Mira" />)
    const { container: withoutName } = render(<EntrantBadge />)
    expect(withName.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(withoutName.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
