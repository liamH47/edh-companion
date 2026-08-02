import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  CloseIcon,
  Icon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShuffleIcon,
  TrashIcon,
  TrophyIcon,
  UndoIcon,
} from './Icon'

describe('Icon', () => {
  it('renders a 20px decorative svg by default', () => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
  })

  it('applies a custom size', () => {
    const { container } = render(<Icon size={32} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '32')
  })

  it('merges a caller-supplied className and passes through extra props', () => {
    const { container } = render(<Icon className="extra" data-testid="probe" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('extra')
    expect(svg).toHaveAttribute('data-testid', 'probe')
  })

  it('renders children inside the svg', () => {
    const { container } = render(
      <Icon>
        <circle cx="1" cy="1" r="1" />
      </Icon>,
    )
    expect(container.querySelector('circle')).toBeInTheDocument()
  })
})

describe.each([
  ['ChevronLeftIcon', ChevronLeftIcon],
  ['InfoIcon', InfoIcon],
  ['PencilIcon', PencilIcon],
  ['CloseIcon', CloseIcon],
  ['SearchIcon', SearchIcon],
  ['UndoIcon', UndoIcon],
  ['PlusIcon', PlusIcon],
  ['TrashIcon', TrashIcon],
  ['ShuffleIcon', ShuffleIcon],
  ['ChevronUpIcon', ChevronUpIcon],
  ['ChevronDownIcon', ChevronDownIcon],
  ['TrophyIcon', TrophyIcon],
])('%s', (_name, Component) => {
  it('renders a decorative svg', () => {
    const { container } = render(<Component />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelector('path, circle')).toBeInTheDocument()
  })

  it('forwards a custom size', () => {
    const { container } = render(<Component size={40} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '40')
  })
})
