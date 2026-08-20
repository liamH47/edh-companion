import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoyaltyBadge, LoyaltyShield } from './LoyaltyShield'

describe('LoyaltyBadge', () => {
  it('shows the formatted value in the badge and announces it politely', () => {
    render(<LoyaltyBadge value={1234} dead={false} />)
    // Twice: the SVG numeral (decoration) and the sr-only live region (announced).
    expect(screen.getAllByText('1,234')).toHaveLength(2)
    const announced = screen
      .getAllByText('1,234')
      .find((node) => node.getAttribute('aria-live') === 'polite')
    expect(announced).toBeDefined()
  })

  it('keeps the neutral shield metal when alive', () => {
    render(<LoyaltyBadge value={5} dead={false} />)
    expect(document.querySelector('path')?.getAttribute('fill')).toBe('#4a4658')
    expect(document.querySelector('text')?.getAttribute('fill')).toBe('#ffffff')
  })

  it('tints with the danger tones when the planeswalker is dead', () => {
    render(<LoyaltyBadge value={0} dead />)
    expect(document.querySelector('path')?.getAttribute('fill')).toBe(
      'var(--color-danger-surface)',
    )
    expect(document.querySelector('text')?.getAttribute('fill')).toBe('var(--color-danger)')
  })
})

describe('LoyaltyShield', () => {
  it('shows the label over the badge', () => {
    render(<LoyaltyShield label="loyalty" value={7} pending={false} dead={false} />)
    expect(screen.getByText('loyalty')).toBeInTheDocument()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
  })

  it('dims while a recalculation is pending, without blanking', () => {
    render(<LoyaltyShield label="loyalty" value={3} pending dead={false} />)
    expect(screen.getByTestId('loyalty-shield').className).toContain('opacity-60')
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })
})
