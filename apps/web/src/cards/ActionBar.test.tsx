import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '@mtg/core'
import { ActionBar } from './ActionBar'

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
    setup: false,
    short_label: null,
    ...overrides,
  }
}

describe('ActionBar', () => {
  it('always renders New turn even with no live fields', async () => {
    const user = userEvent.setup()
    const onNewTurn = vi.fn()
    render(
      <ActionBar
        liveFields={[]}
        values={{}}
        outputs={null}
        onFieldChange={() => {}}
        onNewTurn={onNewTurn}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'New turn' }))
    expect(onNewTurn).toHaveBeenCalledOnce()
  })

  it('renders no action button for a counter without action_label', () => {
    const fields = [field({ name: 'spells', kind: 'counter', label: 'Spells' })]
    render(
      <ActionBar liveFields={fields} values={{ spells: 0 }} outputs={null} onFieldChange={() => {}} onNewTurn={() => {}} />,
    )
    expect(screen.queryAllByRole('button')).toHaveLength(1) // New turn only
  })

  it('renders no action button for a non-counter field even with action_label set', () => {
    const fields = [field({ name: 'life', kind: 'number', label: 'Life', action_label: 'Ignored' })]
    render(
      <ActionBar liveFields={fields} values={{ life: 0 }} outputs={null} onFieldChange={() => {}} onNewTurn={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Ignored' })).not.toBeInTheDocument()
  })

  it('renders an action button that increments the field on click', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    const fields = [
      field({ name: 'activations', kind: 'counter', label: 'Activations', action_label: 'Pay 50 Life' }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ activations: 1 }}
        outputs={null}
        onFieldChange={onFieldChange}
        onNewTurn={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Pay 50 Life' }))
    expect(onFieldChange).toHaveBeenCalledWith('activations', 2)
  })

  it('renders an undo beside the action button that decrements the field', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    const fields = [
      field({ name: 'activations', kind: 'counter', label: 'Activations', action_label: 'Pay 50 Life' }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ activations: 2 }}
        outputs={null}
        onFieldChange={onFieldChange}
        onNewTurn={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Undo Pay 50 Life' }))
    expect(onFieldChange).toHaveBeenCalledWith('activations', 1)
  })

  it('disables the undo at the field minimum', () => {
    const fields = [
      field({
        name: 'activations',
        kind: 'counter',
        label: 'Activations',
        action_label: 'Pay 50 Life',
        min: 0,
      }),
    ]
    render(
      <ActionBar liveFields={fields} values={{ activations: 0 }} outputs={null} onFieldChange={() => {}} onNewTurn={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Undo Pay 50 Life' })).toBeDisabled()
  })

  it('treats a missing/non-numeric value as 0 when incrementing', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    const fields = [
      field({ name: 'activations', kind: 'counter', label: 'Activations', action_label: 'Pay 50 Life' }),
    ]
    render(
      <ActionBar liveFields={fields} values={{}} outputs={null} onFieldChange={onFieldChange} onNewTurn={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Pay 50 Life' }))
    expect(onFieldChange).toHaveBeenCalledWith('activations', 1)
  })

  it('disables the action button at max', () => {
    const fields = [
      field({
        name: 'activations',
        kind: 'counter',
        label: 'Activations',
        max: 2,
        action_label: 'Pay 50 Life',
      }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ activations: 2 }}
        outputs={{ current_life: 999 }}
        onFieldChange={() => {}}
        onNewTurn={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeDisabled()
  })

  it('disables the action button when the output guard blocks it', () => {
    const fields = [
      field({
        name: 'activations',
        kind: 'counter',
        label: 'Activations',
        action_label: 'Pay 50 Life',
        action_disabled_when: { output: 'current_life', less_than: 50 },
      }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ activations: 0 }}
        outputs={{ current_life: 10 }}
        onFieldChange={() => {}}
        onNewTurn={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeDisabled()
  })

  it('enables the action button when the guard is satisfied and not at max', () => {
    const fields = [
      field({
        name: 'activations',
        kind: 'counter',
        label: 'Activations',
        action_label: 'Pay 50 Life',
        action_disabled_when: { output: 'current_life', less_than: 50 },
      }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ activations: 0 }}
        outputs={{ current_life: 100 }}
        onFieldChange={() => {}}
        onNewTurn={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeEnabled()
  })

  describe('sequence fields', () => {
    const rollOptions = [
      { value: '1-2', label: '1–2' },
      { value: '6', label: '6' },
    ]

    function rollsField(overrides: Partial<FieldSpec> = {}): FieldSpec {
      return field({
        name: 'rolls',
        kind: 'sequence',
        label: 'Rolls this turn',
        options: rollOptions,
        ...overrides,
      })
    }

    it('renders one append button per declared option, in a labeled group', () => {
      render(
        <ActionBar
          liveFields={[rollsField()]}
          values={{ rolls: [] }}
          outputs={null}
          onFieldChange={() => {}}
          onNewTurn={() => {}}
        />,
      )
      expect(screen.getByRole('group', { name: 'Rolls this turn' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1–2' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument()
    })

    it('appends the tapped option to the end of the existing log', async () => {
      const user = userEvent.setup()
      const onFieldChange = vi.fn()
      render(
        <ActionBar
          liveFields={[rollsField()]}
          values={{ rolls: ['1-2'] }}
          outputs={null}
          onFieldChange={onFieldChange}
          onNewTurn={() => {}}
        />,
      )
      await user.click(screen.getByRole('button', { name: '6' }))
      expect(onFieldChange).toHaveBeenCalledWith('rolls', ['1-2', '6'])
    })

    it('treats a missing value as an empty log', async () => {
      const user = userEvent.setup()
      const onFieldChange = vi.fn()
      render(
        <ActionBar
          liveFields={[rollsField()]}
          values={{}}
          outputs={null}
          onFieldChange={onFieldChange}
          onNewTurn={() => {}}
        />,
      )
      await user.click(screen.getByRole('button', { name: '1–2' }))
      expect(onFieldChange).toHaveBeenCalledWith('rolls', ['1-2'])
    })

    it('disables every append button once the log hits max', () => {
      render(
        <ActionBar
          liveFields={[rollsField({ max: 2 })]}
          values={{ rolls: ['1-2', '6'] }}
          outputs={null}
          onFieldChange={() => {}}
          onNewTurn={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: '1–2' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '6' })).toBeDisabled()
    })

    it('disables every append button when the output guard blocks it', () => {
      const f = rollsField({
        action_disabled_when: { output: 'activations_remaining', less_than: 1 },
      })
      render(
        <ActionBar
          liveFields={[f]}
          values={{ rolls: [] }}
          outputs={{ activations_remaining: 0 }}
          onFieldChange={() => {}}
          onNewTurn={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: '1–2' })).toBeDisabled()
    })

    it('enables the append buttons while activations remain', () => {
      const f = rollsField({
        action_disabled_when: { output: 'activations_remaining', less_than: 1 },
      })
      render(
        <ActionBar
          liveFields={[f]}
          values={{ rolls: [] }}
          outputs={{ activations_remaining: 2 }}
          onFieldChange={() => {}}
          onNewTurn={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: '1–2' })).toBeEnabled()
    })

    it('renders no append buttons when the field declares no options', () => {
      render(
        <ActionBar
          liveFields={[rollsField({ options: null })]}
          values={{ rolls: [] }}
          outputs={null}
          onFieldChange={() => {}}
          onNewTurn={() => {}}
        />,
      )
      expect(screen.getAllByRole('button')).toHaveLength(1) // New turn only
    })
  })

  it('renders one action button per action-labeled counter', () => {
    const fields = [
      field({ name: 'a', kind: 'counter', label: 'A', action_label: 'Do A' }),
      field({ name: 'b', kind: 'counter', label: 'B', action_label: 'Do B' }),
    ]
    render(
      <ActionBar
        liveFields={fields}
        values={{ a: 0, b: 0 }}
        outputs={null}
        onFieldChange={() => {}}
        onNewTurn={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Do A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do B' })).toBeInTheDocument()
  })
})

describe('ActionBar with a rolled sequence', () => {
  // Hooks rather than inline useFakeTimers/useRealTimers: an assertion that throws
  // mid-test would otherwise leave the clock faked for everything after it.
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const rollsField = field({
    name: 'rolls',
    kind: 'sequence',
    label: 'Rolls this turn',
    options: [1, 2, 3, 4, 5, 6].map((face) => ({ value: String(face), label: String(face) })),
    roll: { faces: 6, action_label: 'Roll the die' },
    action_disabled_when: { output: 'activations_remaining', less_than: 1 },
  })

  function renderBar(overrides: Partial<Parameters<typeof ActionBar>[0]> = {}) {
    const onFieldChange = vi.fn()
    render(
      <ActionBar
        liveFields={[rollsField]}
        values={{ rolls: [] }}
        outputs={{ activations_remaining: 1 }}
        onFieldChange={onFieldChange}
        onNewTurn={vi.fn()}
        rng={() => 0.5}
        {...overrides}
      />,
    )
    return { onFieldChange }
  }

  it('shows one roll button instead of one per face', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeInTheDocument()
    // Offering both a die and six "pick your result" buttons would invite reporting a
    // roll the app never made.
    expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument()
  })

  it('appends the rolled face to the log once the die lands', () => {
    const { onFieldChange } = renderBar({ values: { rolls: ['2'] } })

    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }))
    expect(onFieldChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(900)
    })

    expect(onFieldChange).toHaveBeenCalledWith('rolls', ['2', '4'])
  })

  it('disables the die once the activation guard bites', () => {
    renderBar({ outputs: { activations_remaining: 0 } })

    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeDisabled()
  })

  it('disables the die at the sequence length cap', () => {
    renderBar({
      liveFields: [{ ...rollsField, max: 2 }],
      values: { rolls: ['1', '2'] },
    })

    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeDisabled()
  })
})
