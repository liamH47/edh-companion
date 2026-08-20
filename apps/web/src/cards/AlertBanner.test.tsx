import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlertBanner } from './AlertBanner'

describe('AlertBanner', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<AlertBanner message={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message in an alert role', () => {
    render(<AlertBanner message="Oops, looks like you lose now" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Oops, looks like you lose now')
  })
})


describe('success tone', () => {
  it('renders the payoff styling instead of danger', () => {
    render(<AlertBanner message="Dungeon complete" tone="success" />)
    const banner = screen.getByRole('alert')
    expect(banner.className).toContain('bg-accent-muted')
    expect(screen.getByText('Dungeon complete')).toBeInTheDocument()
  })
})
