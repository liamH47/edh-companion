import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatTile } from './StatTile'

describe('StatTile', () => {
  it('renders the value and label', () => {
    render(<StatTile label="Damage" value={50} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Damage')).toBeInTheDocument()
  })

  it('renders a string value', () => {
    render(<StatTile label="Status" value="ready" />)
    expect(screen.getByText('ready')).toBeInTheDocument()
  })

  it('is not dimmed by default', () => {
    render(<StatTile label="Damage" value={50} />)
    expect(screen.getByText('50').closest('div.px-3')).not.toHaveClass('opacity-60')
  })

  it('dims when pending', () => {
    render(<StatTile label="Damage" value={50} pending />)
    expect(screen.getByText('50').closest('div.px-3')).toHaveClass('opacity-60')
  })
})


describe('compact StatTile', () => {
  it('shrinks type and padding so the tile reads as annotation', () => {
    render(<StatTile label="rooms" value={2} compact />)
    // Compact keeps the content, drops the statTile-size numerals.
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('rooms')).toBeInTheDocument()
  })
})
