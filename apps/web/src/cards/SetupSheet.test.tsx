import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '@mtg/core'
import { SetupSheet } from './SetupSheet'

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
    setup: true,
    short_label: null,
    ...overrides,
  }
}

describe('SetupSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <SetupSheet
        open={false}
        onClose={() => {}}
        fields={[field({ name: 'life', kind: 'number', label: 'Life' })]}
        values={{ life: 40 }}
        onFieldChange={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a FieldControl per field when open', () => {
    render(
      <SetupSheet
        open
        onClose={() => {}}
        fields={[
          field({ name: 'life', kind: 'number', label: 'Life' }),
          field({ name: 'in_play', kind: 'boolean', label: 'In play?' }),
        ]}
        values={{ life: 40, in_play: true }}
        onFieldChange={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: 'Life' })).toHaveValue(40)
    expect(screen.getByRole('group', { name: 'In play?' })).toBeInTheDocument()
  })

  it('reports field changes through onFieldChange', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    render(
      <SetupSheet
        open
        onClose={() => {}}
        fields={[field({ name: 'life', kind: 'number', label: 'Life' })]}
        values={{ life: 40 }}
        onFieldChange={onFieldChange}
        onDone={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Increase Life' }))
    expect(onFieldChange).toHaveBeenCalledWith('life', 41)
  })

  it('calls both onDone and onClose when Done is clicked', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(
      <SetupSheet
        open
        onClose={onClose}
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onDone={onDone}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls only onClose, not onDone, when dismissed via the close button', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(
      <SetupSheet
        open
        onClose={onClose}
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onDone={onDone}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })
})
