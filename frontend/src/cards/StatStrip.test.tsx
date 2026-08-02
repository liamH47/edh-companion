import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OutputSpec } from '../types'
import { StatStrip } from './StatStrip'

function output(overrides: Partial<OutputSpec> & Pick<OutputSpec, 'name'>): OutputSpec {
  return {
    label: overrides.name,
    kind: 'number',
    short_label: null,
    primary: false,
    ...overrides,
  }
}

describe('StatStrip', () => {
  it('renders nothing for an empty output list', () => {
    const { container } = render(<StatStrip outputs={[]} values={{}} pending={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a formatted tile per output, preferring short_label', () => {
    const outputs = [output({ name: 'damage_dealt', label: 'Damage dealt', short_label: 'damage' })]
    render(<StatStrip outputs={outputs} values={{ damage_dealt: 1234567 }} pending={false} />)
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('damage')).toBeInTheDocument()
  })

  it('falls back to label when short_label is null', () => {
    const outputs = [output({ name: 'x', label: 'X Label' })]
    render(<StatStrip outputs={outputs} values={{ x: 1 }} pending={false} />)
    expect(screen.getByText('X Label')).toBeInTheDocument()
  })

  it('renders a text output as-is', () => {
    const outputs = [output({ name: 'status', label: 'Status', kind: 'text' })]
    render(<StatStrip outputs={outputs} values={{ status: 'ready' }} pending={false} />)
    expect(screen.getByText('ready')).toBeInTheDocument()
  })

  it('renders an em dash placeholder when outputs are not yet known', () => {
    const outputs = [output({ name: 'x', label: 'X' })]
    render(<StatStrip outputs={outputs} values={null} pending={false} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('propagates pending to every tile', () => {
    const outputs = [output({ name: 'x', label: 'X' })]
    render(<StatStrip outputs={outputs} values={{ x: 1 }} pending />)
    expect(screen.getByText('1').closest('div.px-3')).toHaveClass('opacity-60')
  })
})
