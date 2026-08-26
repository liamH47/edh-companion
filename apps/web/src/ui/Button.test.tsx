import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

describe('Button', () => {
  it('defaults to a type="button" primary md button', () => {
    render(<Button>Go</Button>)
    const el = screen.getByRole('button', { name: 'Go' })
    expect(el).toHaveAttribute('type', 'button')
    expect(el).toHaveClass('bg-accent', 'min-h-12')
  })

  it.each<ButtonVariant>(['primary', 'secondary', 'ghost', 'danger'])(
    'renders the %s variant',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument()
    },
  )

  it('gives the danger variant its own text color rather than inheriting the default', () => {
    // This exists because the first version was `secondary` plus a `text-danger`
    // className: two text-color utilities at equal specificity, so which applied came
    // down to Tailwind's emission order, and `text-text` was silently winning.
    render(<Button variant="danger">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveClass('text-danger')
    expect(button).not.toHaveClass('text-text')
  })

  it.each<ButtonSize>(['md', 'lg'])('renders the %s size', (size) => {
    render(<Button size={size}>{size}</Button>)
    expect(screen.getByRole('button', { name: size })).toHaveClass('min-h-12')
  })

  it('applies full width when fullWidth is set', () => {
    render(<Button fullWidth>wide</Button>)
    expect(screen.getByRole('button', { name: 'wide' })).toHaveClass('w-full')
  })

  it('omits w-full by default', () => {
    render(<Button>narrow</Button>)
    expect(screen.getByRole('button', { name: 'narrow' })).not.toHaveClass('w-full')
  })

  it('fires onClick and honors disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        click
      </Button>,
    )
    await user.click(screen.getByRole('button', { name: 'click' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('respects an explicit type override', () => {
    render(<Button type="submit">submit</Button>)
    expect(screen.getByRole('button', { name: 'submit' })).toHaveAttribute('type', 'submit')
  })

  it('merges a caller-supplied className', () => {
    render(<Button className="extra">extra-class</Button>)
    expect(screen.getByRole('button', { name: 'extra-class' })).toHaveClass('extra')
  })
})
