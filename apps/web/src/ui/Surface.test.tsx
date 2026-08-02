import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface } from './Surface'

describe('Surface', () => {
  it('renders children with base level, md radius, and padding by default', () => {
    render(<Surface>content</Surface>)
    const el = screen.getByText('content')
    expect(el).toHaveClass('bg-surface', 'rounded-md', 'p-4')
  })

  it('applies the raised level classes', () => {
    render(<Surface level="raised">content</Surface>)
    expect(screen.getByText('content')).toHaveClass('bg-surface-raised')
  })

  it('applies sm and lg radius classes', () => {
    const { rerender } = render(<Surface radius="sm">content</Surface>)
    expect(screen.getByText('content')).toHaveClass('rounded-sm')
    rerender(<Surface radius="lg">content</Surface>)
    expect(screen.getByText('content')).toHaveClass('rounded-lg')
  })

  it('omits padding when padded is false', () => {
    render(<Surface padded={false}>content</Surface>)
    expect(screen.getByText('content')).not.toHaveClass('p-4')
  })

  it('merges a caller-supplied className', () => {
    render(<Surface className="extra">content</Surface>)
    expect(screen.getByText('content')).toHaveClass('extra')
  })
})
