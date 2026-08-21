import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '@mtg/core'
import { SourcePicker } from './SourcePicker'

function pickerField(overrides: Partial<FieldSpec> = {}): FieldSpec {
  return {
    name: 'sources',
    label: 'Landfall permanents you control',
    kind: 'sequence',
    default: [],
    min: null,
    max: 3,
    options: [
      { value: 'lotus-cobra', label: 'Lotus Cobra', scryfall_id: 'a4b759f0-901f-4be3-93fa-224609b08d48' },
      { value: 'tatyova', label: 'Tatyova, Benthic Druid', scryfall_id: null },
      { value: 'ruin-crab', label: 'Ruin Crab', scryfall_id: null },
    ],
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    map: null,
    picker: { search_placeholder: 'Search landfall cards', empty_label: 'Nothing added yet.' },
    persists_across_turns: true,
    new_turn_carries_output: null,
    setup: true,
    short_label: null,
    ...overrides,
  }
}

describe('SourcePicker', () => {
  it('shows the empty label and the search box before anything is added', () => {
    render(<SourcePicker field={pickerField()} value={[]} onChange={() => {}} />)
    expect(screen.getByText('Nothing added yet.')).toBeInTheDocument()
    expect(screen.getByLabelText('Search landfall cards')).toBeInTheDocument()
  })

  it('lists nothing until something is typed, so the roster keeps the screen', () => {
    render(<SourcePicker field={pickerField()} value={[]} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Add Lotus Cobra' })).not.toBeInTheDocument()
  })

  it('searches case-insensitively and adds the tapped card', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SourcePicker field={pickerField()} value={[]} onChange={onChange} />)

    await user.type(screen.getByLabelText('Search landfall cards'), 'COBRA')
    expect(screen.queryByRole('button', { name: 'Add Tatyova, Benthic Druid' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Lotus Cobra' }))
    expect(onChange).toHaveBeenCalledWith('sources', ['lotus-cobra'])
  })

  it('says so when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<SourcePicker field={pickerField()} value={[]} onChange={() => {}} />)
    await user.type(screen.getByLabelText('Search landfall cards'), 'zzz')
    expect(screen.getByText('Nothing matches "zzz".')).toBeInTheDocument()
  })

  it('collapses duplicates to one row with a count', () => {
    render(
      <SourcePicker field={pickerField()} value={['lotus-cobra', 'lotus-cobra']} onChange={() => {}} />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('x2', { exact: false })).toBeInTheDocument()
  })

  it('adds another copy from the roster row -- two Cobras are two abilities', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SourcePicker field={pickerField()} value={['lotus-cobra']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Add another Lotus Cobra' }))
    expect(onChange).toHaveBeenCalledWith('sources', ['lotus-cobra', 'lotus-cobra'])
  })

  it('removes one copy at a time, not the whole row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SourcePicker
        field={pickerField()}
        value={['lotus-cobra', 'tatyova', 'lotus-cobra']}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Remove Lotus Cobra' }))
    expect(onChange).toHaveBeenCalledWith('sources', ['lotus-cobra', 'tatyova'])
  })

  it('stops offering additions at the declared cap', () => {
    render(
      <SourcePicker
        field={pickerField()}
        value={['lotus-cobra', 'tatyova', 'ruin-crab']}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText("That's the maximum this tracker holds.")).toBeInTheDocument()
    expect(screen.queryByLabelText('Search landfall cards')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add another/ })).not.toBeInTheDocument()
    // Removing stays available -- otherwise a full roster would be a dead end.
    expect(screen.getByRole('button', { name: 'Remove Ruin Crab' })).toBeInTheDocument()
  })

  it('falls back to the option value when a label is missing', () => {
    // The schema forbids it, but the component is generic and must not crash on data
    // it did not validate itself.
    render(
      <SourcePicker field={pickerField({ options: null })} value={['lotus-cobra']} onChange={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Remove lotus-cobra' })).toBeInTheDocument()
  })

  it('uses generic defaults when the picker spec is absent', () => {
    render(<SourcePicker field={pickerField({ picker: null })} value={[]} onChange={() => {}} />)
    expect(screen.getByText('Nothing added yet.')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('keeps removing available at the cap, so a full roster is not a dead end', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SourcePicker field={pickerField({ max: 1 })} value={['lotus-cobra']} onChange={onChange} />,
    )
    expect(screen.queryByRole('button', { name: 'Add another Lotus Cobra' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Lotus Cobra' }))
    expect(onChange).toHaveBeenCalledWith('sources', [])
  })

  it('has no cap when the field declares none', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SourcePicker
        field={pickerField({ max: null })}
        value={['lotus-cobra', 'tatyova', 'ruin-crab']}
        onChange={onChange}
      />,
    )
    expect(screen.getByLabelText('Search landfall cards')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add another Ruin Crab' }))
    expect(onChange).toHaveBeenCalledWith('sources', [
      'lotus-cobra',
      'tatyova',
      'ruin-crab',
      'ruin-crab',
    ])
  })
})
