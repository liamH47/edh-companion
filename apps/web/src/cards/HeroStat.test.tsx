import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroStat } from './HeroStat'

describe('HeroStat', () => {
  it('renders the label and formatted value', () => {
    render(<HeroStat label="Damage available" value={1234} pending={false} />)
    expect(screen.getByText('Damage available')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('is announced via aria-live', () => {
    render(<HeroStat label="Damage available" value={50} pending={false} />)
    expect(screen.getByText('50')).toHaveAttribute('aria-live', 'polite')
  })

  it('is not dimmed by default', () => {
    render(<HeroStat label="Damage available" value={50} pending={false} />)
    expect(screen.getByText('50').parentElement).not.toHaveClass('opacity-60')
  })

  it('dims while pending', () => {
    render(<HeroStat label="Damage available" value={50} pending />)
    expect(screen.getByText('50').parentElement).toHaveClass('opacity-60')
  })

  it.each([
    [50, 'text-hero-lg'],
    [12345, 'text-hero-md'],
    [1234567, 'text-hero-sm'],
  ])('sizes %i as %s', (value, expectedClass) => {
    render(<HeroStat label="X" value={value} pending={false} />)
    expect(screen.getByText(value.toLocaleString('en-US'))).toHaveClass(expectedClass)
  })
})
