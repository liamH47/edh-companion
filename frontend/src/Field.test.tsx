import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Field } from './Field'
import type { FieldSpec } from './types'

const booleanField: FieldSpec = {
  name: 'flag',
  label: 'Flag',
  kind: 'boolean',
  default: true,
  min: null,
  max: null,
  options: null,
  visible_if: null,
  help_text: null,
  default_source: null,
  action_label: null,
  action_disabled_when: null,
}

const numberField: FieldSpec = {
  name: 'count',
  label: 'Count',
  kind: 'number',
  default: 0,
  min: 0,
  max: 99,
  options: null,
  visible_if: null,
  help_text: null,
  default_source: null,
  action_label: null,
  action_disabled_when: null,
}

const selectField: FieldSpec = {
  name: 'mode',
  label: 'Mode',
  kind: 'select',
  default: 'a',
  min: null,
  max: null,
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ],
  visible_if: null,
  help_text: null,
  default_source: null,
  action_label: null,
  action_disabled_when: null,
}

const counterField: FieldSpec = {
  name: 'spells',
  label: 'Cast a spell',
  kind: 'counter',
  default: 0,
  min: 0,
  max: 2,
  options: null,
  visible_if: null,
  help_text: null,
  default_source: null,
  action_label: null,
  action_disabled_when: null,
}

describe('Field', () => {
  it('renders a checkbox for boolean fields and reports toggles', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Field field={booleanField} value={true} onChange={onChange} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Flag' })
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    expect(onChange).toHaveBeenCalledWith('flag', false)
  })

  it('renders a number input and reports numeric changes', () => {
    const onChange = vi.fn()
    render(<Field field={numberField} value={3} onChange={onChange} />)

    // A single change event, not simulated keystrokes: the `value` prop stays fixed
    // in this isolated render (no wrapping state), so typing key-by-key would fight
    // React's controlled-input re-render. CardForm's own tests cover real typed input.
    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith('count', 7)
  })

  it('renders a select input and reports the selected option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Field field={selectField} value="a" onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Mode'), 'b')
    expect(onChange).toHaveBeenCalledWith('mode', 'b')
  })

  it('renders a counter with a running count and increments on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Field field={counterField} value={0} onChange={onChange} />)

    expect(screen.getByLabelText('Cast a spell')).toHaveValue(0)
    await user.click(screen.getByRole('button', { name: '+1' }))
    expect(onChange).toHaveBeenCalledWith('spells', 1)
  })

  it('disables the counter button once the value reaches its max', () => {
    render(<Field field={counterField} value={2} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })

  it('accepts a directly typed value for a counter field', () => {
    const onChange = vi.fn()
    render(<Field field={counterField} value={0} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Cast a spell'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith('spells', 2)
  })

  it('throws for an unrecognized field kind from the API', () => {
    const invalidField = { ...booleanField, kind: 'unknown' } as unknown as FieldSpec
    expect(() =>
      render(<Field field={invalidField} value={null} onChange={vi.fn()} />),
    ).toThrow(/Unhandled field kind/)
  })

  it('falls back to 0 and unbounded min/max for a number field given a non-numeric value', () => {
    const unboundedNumberField: FieldSpec = { ...numberField, min: null, max: null }
    render(<Field field={unboundedNumberField} value={undefined} onChange={vi.fn()} />)

    const input = screen.getByLabelText('Count') as HTMLInputElement
    expect(input.value).toBe('0')
    expect(input.min).toBe('')
    expect(input.max).toBe('')
  })

  it('renders a select field without crashing given a non-string value', () => {
    // A <select> with no matching option auto-selects the first option regardless of
    // what React requested, so this only asserts the fallback code path doesn't throw.
    render(<Field field={selectField} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Mode')).toBeInTheDocument()
  })

  it('renders no options for a select field whose options were omitted by the API', () => {
    const optionlessSelectField = { ...selectField, options: null }
    render(<Field field={optionlessSelectField} value="a" onChange={vi.fn()} />)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('falls back to 0 for a counter field given a non-numeric value', () => {
    render(<Field field={counterField} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Cast a spell')).toHaveValue(0)
  })

  it('renders an unbounded counter field with no min/max attributes', () => {
    const unboundedCounterField: FieldSpec = { ...counterField, min: null, max: null }
    render(<Field field={unboundedCounterField} value={0} onChange={vi.fn()} />)

    const input = screen.getByLabelText('Cast a spell') as HTMLInputElement
    expect(input.min).toBe('')
    expect(input.max).toBe('')
  })

  it('uses the default "+1" button label when a counter field has no action_label', () => {
    render(<Field field={counterField} value={0} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeInTheDocument()
  })

  it('uses a counter field\'s action_label as the button text when provided', () => {
    const payLifeField: FieldSpec = { ...counterField, action_label: 'Pay 50 Life' }
    render(<Field field={payLifeField} value={0} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+1' })).not.toBeInTheDocument()
  })

  it('disables the action button when the guarded output is below the threshold', () => {
    const guardedField: FieldSpec = {
      ...counterField,
      action_disabled_when: { output: 'current_life', less_than: 50 },
    }
    render(
      <Field field={guardedField} value={0} onChange={vi.fn()} outputs={{ current_life: 40 }} />,
    )
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })

  it('enables the action button once the guarded output meets the threshold', () => {
    const guardedField: FieldSpec = {
      ...counterField,
      action_disabled_when: { output: 'current_life', less_than: 50 },
    }
    render(
      <Field field={guardedField} value={0} onChange={vi.fn()} outputs={{ current_life: 50 }} />,
    )
    expect(screen.getByRole('button', { name: '+1' })).toBeEnabled()
  })

  it('disables the action button when outputs are not known yet', () => {
    const guardedField: FieldSpec = {
      ...counterField,
      action_disabled_when: { output: 'current_life', less_than: 50 },
    }
    render(<Field field={guardedField} value={0} onChange={vi.fn()} outputs={null} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })

  it('disables the action button when the guarded output is missing or non-numeric', () => {
    const guardedField: FieldSpec = {
      ...counterField,
      action_disabled_when: { output: 'current_life', less_than: 50 },
    }
    render(<Field field={guardedField} value={0} onChange={vi.fn()} outputs={{}} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })
})
