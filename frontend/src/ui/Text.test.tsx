import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Text, type TextColor, type TextVariant } from './Text'

describe('Text', () => {
  it('defaults to the body variant, default color, and a span element', () => {
    render(<Text>hello</Text>)
    const el = screen.getByText('hello')
    expect(el.tagName).toBe('SPAN')
    expect(el).toHaveClass('text-body', 'text-text', 'tabular-nums')
  })

  it.each<TextVariant>([
    'label',
    'body',
    'bodyStrong',
    'title',
    'statTile',
    'heroSm',
    'heroMd',
    'heroLg',
  ])('applies size classes for the %s variant', (variant) => {
    render(<Text variant={variant}>content-{variant}</Text>)
    expect(screen.getByText(`content-${variant}`)).toBeInTheDocument()
  })

  it.each<TextColor>(['default', 'muted', 'accent', 'danger'])(
    'applies color classes for %s',
    (color) => {
      const expected: Record<TextColor, string> = {
        default: 'text-text',
        muted: 'text-text-muted',
        accent: 'text-accent',
        danger: 'text-danger',
      }
      render(<Text color={color}>color-{color}</Text>)
      expect(screen.getByText(`color-${color}`)).toHaveClass(expected[color])
    },
  )

  it('renders as a custom element via the `as` prop', () => {
    render(<Text as="h1">heading</Text>)
    expect(screen.getByText('heading').tagName).toBe('H1')
  })

  it('merges a caller-supplied className', () => {
    render(<Text className="extra">content</Text>)
    expect(screen.getByText('content')).toHaveClass('extra')
  })

  it('forwards unknown props like id to the underlying element', () => {
    render(<Text id="probe">content</Text>)
    expect(screen.getByText('content')).toHaveAttribute('id', 'probe')
  })

  it('marks the label variant uppercase with wide tracking', () => {
    render(<Text variant="label">tag</Text>)
    expect(screen.getByText('tag')).toHaveClass('uppercase', 'tracking-[0.06em]')
  })
})
