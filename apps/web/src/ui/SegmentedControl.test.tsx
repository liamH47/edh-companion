import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'

type Die = 'd6' | '2d6' | 'd20'
const OPTIONS: SegmentedOption<Die>[] = [
  { value: 'd6', label: 'd6' },
  { value: '2d6', label: '2d6' },
  { value: 'd20', label: 'd20' },
]

function setup(overrides: Partial<Parameters<typeof SegmentedControl<Die>>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <SegmentedControl value="d6" onChange={onChange} options={OPTIONS} label="Dice" {...overrides} />,
  )
  return { onChange }
}

describe('SegmentedControl', () => {
  it('exposes the options as a labelled radiogroup', () => {
    setup()
    expect(screen.getByRole('radiogroup', { name: 'Dice' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('marks the selected value checked and the rest unchecked', () => {
    setup({ value: '2d6' })
    expect(screen.getByRole('radio', { name: '2d6' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'd6' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'd20' })).not.toBeChecked()
  })

  it('reports the chosen value on click', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: 'd20' }))
    expect(onChange).toHaveBeenCalledWith('d20')
  })

  it('does not fire when disabled', () => {
    const { onChange } = setup({ disabled: true })
    const radio = screen.getByRole('radio', { name: 'd20' })
    expect(radio).toBeDisabled()
    fireEvent.click(radio)
    expect(onChange).not.toHaveBeenCalled()
  })
})
