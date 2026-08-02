import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders as a plain span when no onClick is given', () => {
    render(<Chip>40 life</Chip>)
    const el = screen.getByText('40 life')
    expect(el.tagName).toBe('SPAN')
  })

  it('renders as a button and fires onClick when given', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Chip onClick={onClick}>tap me</Chip>)
    const el = screen.getByRole('button', { name: 'tap me' })
    await user.click(el)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('merges a caller-supplied className', () => {
    render(<Chip className="extra">40 life</Chip>)
    expect(screen.getByText('40 life')).toHaveClass('extra')
  })
})
