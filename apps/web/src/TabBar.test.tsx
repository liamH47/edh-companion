import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  it('renders a tab per destination', () => {
    render(<TabBar active="cards" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coin Flip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pairings' })).toBeInTheDocument()
  })

  it('marks only the active tab current', () => {
    render(<TabBar active="cards" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Coin Flip' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Pairings' })).not.toHaveAttribute('aria-current')
  })

  it.each([
    ['Cards', 'cards'],
    ['Coin Flip', 'coin'],
    ['Pairings', 'swiss'],
  ])('reports %s as %s when tapped', async (label, expected) => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TabBar active="cards" onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: label }))
    expect(onSelect).toHaveBeenCalledWith(expected)
  })

  it('marks the pairings tab current when it is active', () => {
    render(<TabBar active="swiss" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Pairings' })).toHaveAttribute('aria-current', 'page')
  })
})
