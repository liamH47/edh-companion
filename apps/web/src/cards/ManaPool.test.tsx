import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '@mtg/core'
import { ManaPool } from './ManaPool'

function poolField(overrides: Partial<FieldSpec> = {}): FieldSpec {
  return {
    name: 'pool',
    label: 'Floating mana',
    kind: 'sequence',
    default: [],
    min: null,
    max: 6,
    options: [
      { value: 'W', label: 'White', scryfall_id: null },
      { value: 'U', label: 'Blue', scryfall_id: null },
      { value: 'G', label: 'Green', scryfall_id: null },
      { value: 'C', label: 'Colorless', scryfall_id: null },
    ],
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    map: null,
    picker: null,
    mana: {},
    persists_across_turns: false,
    new_turn_carries_output: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

describe('ManaPool', () => {
  it('offers one add and one spend control per declared color', () => {
    render(<ManaPool field={poolField()} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Add green mana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add colorless mana' })).toBeInTheDocument()
    // Nothing floating, so nothing can be spent.
    expect(screen.getByRole('button', { name: 'Spend green mana' })).toBeDisabled()
  })

  it('adds a mana of the tapped color', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ManaPool field={poolField()} value={['G']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Add blue mana' }))
    expect(onChange).toHaveBeenCalledWith('pool', ['G', 'U'])
  })

  it('spends one of a color, keeping the rest', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ManaPool field={poolField()} value={['G', 'U', 'G']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Spend green mana' }))
    expect(onChange).toHaveBeenCalledWith('pool', ['G', 'U'])
  })

  it('shows each color count, and names it for a screen reader', () => {
    // Hue is exactly what a screen reader cannot convey, so the count carries the word.
    render(<ManaPool field={poolField()} value={['G', 'G', 'C']} onChange={() => {}} />)
    expect(screen.getByText('green:').parentElement).toHaveTextContent('2')
    expect(screen.getByText('colorless:').parentElement).toHaveTextContent('1')
    expect(screen.getByText('white:').parentElement).toHaveTextContent('0')
  })

  it('empties the whole pool, since a phase change does that by rule', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ManaPool field={poolField()} value={['G', 'U']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Empty the pool' }))
    expect(onChange).toHaveBeenCalledWith('pool', [])
  })

  it('offers no empty button when the pool is already empty', () => {
    render(<ManaPool field={poolField()} value={[]} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Empty the pool' })).not.toBeInTheDocument()
  })

  it('stops adding at the declared cap but still allows spending', () => {
    render(
      <ManaPool
        field={poolField({ max: 2 })}
        value={['G', 'G']}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add green mana' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Spend green mana' })).toBeEnabled()
    expect(screen.getByText("That's as much as this pool holds.")).toBeInTheDocument()
  })

  it('has no cap when the field declares none', () => {
    render(<ManaPool field={poolField({ max: null })} value={['G']} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Add green mana' })).toBeEnabled()
  })

  it('falls back to the raw symbol when a color has no name', () => {
    // The schema forbids it, but the component is generic and must not crash on data
    // it did not validate itself.
    render(
      <ManaPool
        field={poolField({ options: [{ value: 'X', label: 'Weird', scryfall_id: null }] })}
        value={[]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add X mana' })).toBeInTheDocument()
  })

  it('renders nothing per color when the field declares no options', () => {
    render(<ManaPool field={poolField({ options: null })} value={[]} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })
})
