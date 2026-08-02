import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pressable } from './Pressable'

describe('Pressable', () => {
  it('renders as a type="button" button by default', () => {
    render(<Pressable>row</Pressable>)
    expect(screen.getByRole('button', { name: 'row' })).toHaveAttribute('type', 'button')
  })

  it('fires onClick when enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Pressable onClick={onClick}>tap</Pressable>)
    await user.click(screen.getByRole('button', { name: 'tap' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Pressable onClick={onClick} disabled>
        tap
      </Pressable>,
    )
    await user.click(screen.getByRole('button', { name: 'tap' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('merges a caller-supplied className', () => {
    render(<Pressable className="extra">row</Pressable>)
    expect(screen.getByRole('button', { name: 'row' })).toHaveClass('extra')
  })

  it('respects an explicit type override', () => {
    render(<Pressable type="submit">go</Pressable>)
    expect(screen.getByRole('button', { name: 'go' })).toHaveAttribute('type', 'submit')
  })
})
