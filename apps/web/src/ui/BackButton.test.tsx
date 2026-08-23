import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackButton } from './BackButton'

describe('BackButton', () => {
  it('renders a bare icon circle named "Back" when no label is given', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<BackButton onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders icon-plus-text named after the label when one is given', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<BackButton onClick={onClick} label="Pairings" />)
    // The chevron icon is decorative -- the accessible name is the label alone, not
    // a typed "‹" character baked into it.
    await user.click(screen.getByRole('button', { name: 'Pairings' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('merges a caller-supplied className onto either shape', () => {
    const { rerender } = render(<BackButton onClick={() => {}} className="self-start" />)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('self-start')

    rerender(<BackButton onClick={() => {}} label="Pairings" className="self-start" />)
    expect(screen.getByRole('button', { name: 'Pairings' })).toHaveClass('self-start')
  })
})
