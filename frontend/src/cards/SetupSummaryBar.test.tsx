import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '../types'
import { SetupSummaryBar } from './SetupSummaryBar'

function field(overrides: Partial<FieldSpec> & Pick<FieldSpec, 'name' | 'kind'>): FieldSpec {
  return {
    label: overrides.name,
    default: null,
    min: null,
    max: null,
    options: null,
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    setup: true,
    short_label: null,
    ...overrides,
  }
}

describe('SetupSummaryBar', () => {
  it('renders nothing when there are no setup fields', () => {
    const { container } = render(<SetupSummaryBar fields={[]} values={{}} onPress={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chip per field, summarized', () => {
    const fields = [
      field({ name: 'starting_life', kind: 'number', short_label: 'start life' }),
      field({ name: 'in_play', kind: 'boolean', short_label: 'in play' }),
    ]
    render(<SetupSummaryBar fields={fields} values={{ starting_life: 40, in_play: true }} onPress={() => {}} />)
    expect(screen.getByText('40 start life')).toBeInTheDocument()
    expect(screen.getByText('in play ✓')).toBeInTheDocument()
  })

  it('calls onPress when the bar is tapped', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    const fields = [field({ name: 'a', kind: 'number', short_label: 'a' })]
    render(<SetupSummaryBar fields={fields} values={{ a: 1 }} onPress={onPress} />)
    await user.click(screen.getByRole('button', { name: 'Edit board state' }))
    expect(onPress).toHaveBeenCalledOnce()
  })
})
