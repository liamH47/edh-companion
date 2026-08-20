import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '@mtg/core'
import { FieldControl } from './FieldControl'

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
    map: null,
    new_turn_carries_output: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

describe('FieldControl', () => {
  describe('boolean', () => {
    it('renders a Toggle and reports changes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const f = field({ name: 'in_play', kind: 'boolean', label: 'In play?' })
      render(<FieldControl field={f} value={true} onChange={onChange} />)
      expect(screen.getByRole('group', { name: 'In play?' })).toBeInTheDocument()
      await user.click(screen.getByText('No'))
      expect(onChange).toHaveBeenCalledWith('in_play', false)
    })
  })

  describe('number', () => {
    it('renders a Stepper bounded by min/max and reports changes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const f = field({ name: 'life', kind: 'number', label: 'Life', min: 0, max: 99999 })
      render(<FieldControl field={f} value={40} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: 'Increase Life' }))
      expect(onChange).toHaveBeenCalledWith('life', 41)
    })

    it('defaults a non-numeric value to 0', () => {
      const f = field({ name: 'life', kind: 'number', label: 'Life' })
      render(<FieldControl field={f} value={null} onChange={() => {}} />)
      expect(screen.getByRole('spinbutton', { name: 'Life' })).toHaveValue(0)
    })

    it('renders help text when present', () => {
      const f = field({ name: 'life', kind: 'number', label: 'Life', help_text: 'Starting total' })
      render(<FieldControl field={f} value={0} onChange={() => {}} />)
      expect(screen.getByText('Starting total')).toBeInTheDocument()
    })

    it('renders no help text paragraph when absent', () => {
      const f = field({ name: 'life', kind: 'number', label: 'Life' })
      render(<FieldControl field={f} value={0} onChange={() => {}} />)
      expect(screen.queryByText('Starting total')).not.toBeInTheDocument()
    })
  })

  describe('counter', () => {
    it('renders a bounded Stepper and reports changes, with no action button of its own', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const f = field({
        name: 'spells',
        kind: 'counter',
        label: 'Spells cast',
        action_label: 'Pay 50 Life',
      })
      render(<FieldControl field={f} value={2} onChange={onChange} />)
      expect(screen.queryByRole('button', { name: 'Pay 50 Life' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Increase Spells cast' }))
      expect(onChange).toHaveBeenCalledWith('spells', 3)
    })

    it('defaults a non-numeric counter value to 0', () => {
      const f = field({ name: 'spells', kind: 'counter', label: 'Spells cast' })
      render(<FieldControl field={f} value={null} onChange={() => {}} />)
      expect(screen.getByRole('spinbutton', { name: 'Spells cast' })).toHaveValue(0)
    })
  })

  describe('select', () => {
    const options = [
      { value: 'a', label: 'Mode A' },
      { value: 'b', label: 'Mode B' },
    ]

    it('renders a radiogroup of options and reports the selected value', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const f = field({ name: 'mode', kind: 'select', label: 'Mode', options })
      render(<FieldControl field={f} value="a" onChange={onChange} />)
      const group = screen.getByRole('radiogroup', { name: 'Mode' })
      expect(group).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Mode A' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('radio', { name: 'Mode B' })).toHaveAttribute('aria-checked', 'false')
      await user.click(screen.getByRole('radio', { name: 'Mode B' }))
      expect(onChange).toHaveBeenCalledWith('mode', 'b')
    })

    it('renders no options when options is null', () => {
      const f = field({ name: 'mode', kind: 'select', label: 'Mode', options: null })
      render(<FieldControl field={f} value={null} onChange={() => {}} />)
      expect(screen.queryAllByRole('radio')).toHaveLength(0)
    })
  })

  describe('mapped sequence', () => {
    const mapSpec = {
      entry: 'cave',
      scryfall_id: null,
      nodes: [
        { id: 'cave', column: 0, row: 0, art: null },
        { id: 'lair', column: 1, row: 0, art: null },
      ],
      edges: [{ source: 'cave', target: 'lair' }],
    }
    const mapped = () =>
      field({
        name: 'path',
        kind: 'sequence',
        label: 'Your path',
        options: [
          { value: 'cave', label: 'Cave Entrance' },
          { value: 'lair', label: 'Goblin Lair' },
        ],
        map: mapSpec,
      })

    it('renders the dungeon map instead of the chip log', () => {
      render(<FieldControl field={mapped()} value={['cave']} onChange={() => {}} />)
      expect(screen.getByTestId('dungeon-map-path')).toBeInTheDocument()
      expect(screen.queryByText('Nothing yet.')).not.toBeInTheDocument()
    })

    it('pops the last room via the undo control', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<FieldControl field={mapped()} value={['cave', 'lair']} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: 'Undo last Your path' }))
      expect(onChange).toHaveBeenCalledWith('path', ['cave'])
    })

    it('hides the undo before the first venture', () => {
      render(<FieldControl field={mapped()} value={[]} onChange={() => {}} />)
      expect(screen.queryByRole('button', { name: 'Undo last Your path' })).not.toBeInTheDocument()
    })
  })

  describe('sequence', () => {
    const rollOptions = [
      { value: '1-2', label: '1–2' },
      { value: '4-5', label: '4–5' },
    ]

    function rollsField() {
      return field({ name: 'rolls', kind: 'sequence', label: 'Rolls this turn', options: rollOptions })
    }

    it('shows an empty-state message and no undo before anything is logged', () => {
      render(<FieldControl field={rollsField()} value={[]} onChange={() => {}} />)
      expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
    })

    it('renders one chip per entry, in order, using the option labels', () => {
      render(<FieldControl field={rollsField()} value={['1-2', '4-5', '1-2']} onChange={() => {}} />)
      const items = screen.getAllByRole('listitem')
      expect(items.map((item) => item.textContent)).toEqual(['1–2', '4–5', '1–2'])
    })

    it('falls back to the raw entry when no option matches it', () => {
      render(<FieldControl field={rollsField()} value={['mystery']} onChange={() => {}} />)
      expect(screen.getByText('mystery')).toBeInTheDocument()
    })

    it('renders no append buttons -- those live in the ActionBar', () => {
      render(<FieldControl field={rollsField()} value={['1-2']} onChange={() => {}} />)
      expect(screen.queryByRole('button', { name: '1–2' })).not.toBeInTheDocument()
    })

    it('undo removes only the last entry', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<FieldControl field={rollsField()} value={['1-2', '4-5']} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: 'Undo last Rolls this turn' }))
      expect(onChange).toHaveBeenCalledWith('rolls', ['1-2'])
    })

    it('treats a non-array value as empty', () => {
      render(<FieldControl field={rollsField()} value={null} onChange={() => {}} />)
      expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
    })

    it('renders no chips when the field declares no options', () => {
      const f = field({ name: 'rolls', kind: 'sequence', label: 'Rolls', options: null })
      render(<FieldControl field={f} value={['x']} onChange={() => {}} />)
      expect(screen.getByText('x')).toBeInTheDocument()
    })
  })

  it('throws for an unrecognized field kind from the API', () => {
    const invalidField = { ...field({ name: 'x', kind: 'boolean' }), kind: 'unknown' } as unknown as FieldSpec
    expect(() => render(<FieldControl field={invalidField} value={null} onChange={vi.fn()} />)).toThrow(
      /Unhandled field kind/,
    )
  })
})
