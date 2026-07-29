import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { CardForm } from './CardForm'
import type { CardMetadata } from './types'

vi.mock('./api')

const aetherfluxCard: CardMetadata = {
  id: 'aetherflux-reservoir',
  name: 'Aetherflux Reservoir',
  rules_text: "Whenever you cast a spell, you gain 1 life for each spell you've cast this turn.",
  fields: [
    {
      name: 'starting_life',
      label: 'Life total at the start of the turn',
      kind: 'number',
      default: 40,
      min: 0,
      max: 99999,
      options: null,
      visible_if: null,
      help_text: null,
      default_source: null,
      action_label: null,
      action_disabled_when: null,
    },
    {
      name: 'was_in_play_at_turn_start',
      label: 'In play at the start of the turn?',
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
    },
    {
      name: 'spells_already_cast',
      label: 'Spells already cast before it entered',
      kind: 'number',
      default: 0,
      min: 0,
      max: 99,
      options: null,
      visible_if: { field: 'was_in_play_at_turn_start', equals: false },
      help_text: null,
      default_source: null,
      action_label: null,
      action_disabled_when: null,
    },
    {
      name: 'spells_cast_this_turn',
      label: 'Spells cast this turn',
      kind: 'counter',
      default: 0,
      min: 0,
      max: 99,
      options: null,
      visible_if: null,
      help_text: null,
      default_source: 'spells_already_cast',
      action_label: null,
      action_disabled_when: null,
    },
    {
      name: 'activations_used',
      label: 'Activations used',
      kind: 'counter',
      default: 0,
      min: 0,
      max: 99,
      options: null,
      visible_if: null,
      help_text: null,
      default_source: null,
      action_label: 'Pay 50 Life',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    },
  ],
  outputs: [
    { name: 'life_this_spell', label: 'Life gained this spell', kind: 'number' },
    { name: 'total_life', label: 'Total life gained', kind: 'number' },
  ],
}

describe('CardForm', () => {
  beforeEach(() => {
    // current_life defaults comfortably above the Pay 50 Life guard (50) so existing
    // interaction tests aren't incidentally blocked by it; guard-specific tests below
    // override this per-case.
    vi.mocked(api.calculateCard).mockResolvedValue({
      outputs: { life_this_spell: 0, total_life: 0, current_life: 100 },
    })
  })

  it('calculates on mount using the card defaults', async () => {
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenCalledWith('aetherflux-reservoir', {
        starting_life: 40,
        was_in_play_at_turn_start: true,
        spells_already_cast: 0,
        spells_cast_this_turn: 0,
        activations_used: 0,
      }),
    )
    expect(await screen.findByText('Total life gained')).toBeInTheDocument()
  })

  it('shows the card name instead of the full rules text', async () => {
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('heading', { name: 'Aetherflux Reservoir' })).toBeInTheDocument()
    expect(screen.queryByText(aetherfluxCard.rules_text)).not.toBeInTheDocument()
  })

  it('hides the conditional field until the field it depends on is false', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    expect(
      screen.queryByLabelText('Spells already cast before it entered'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'In play at the start of the turn?' }))
    expect(screen.getByLabelText('Spells already cast before it entered')).toBeInTheDocument()
  })

  it('recalculates with updated values when a field changes', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '+1' }))

    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenLastCalledWith(
        'aetherflux-reservoir',
        expect.objectContaining({ spells_cast_this_turn: 1 }),
      ),
    )
  })

  it('resets fields and recalculates defaults on "New turn"', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '+1' }))
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('button', { name: 'New turn' }))
    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenLastCalledWith(
        'aetherflux-reservoir',
        expect.objectContaining({ spells_cast_this_turn: 0 }),
      ),
    )
  })

  it('syncs "spells cast this turn" to the baseline as soon as it is set', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('checkbox', { name: 'In play at the start of the turn?' }))
    fireEvent.change(screen.getByLabelText('Spells already cast before it entered'), {
      target: { value: '2' },
    })

    expect(screen.getByLabelText('Spells cast this turn')).toHaveValue(2)
    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenLastCalledWith(
        'aetherflux-reservoir',
        expect.objectContaining({ spells_already_cast: 2, spells_cast_this_turn: 2 }),
      ),
    )
  })

  it('lets the synced counter still be incremented independently afterward', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('checkbox', { name: 'In play at the start of the turn?' }))
    fireEvent.change(screen.getByLabelText('Spells already cast before it entered'), {
      target: { value: '2' },
    })
    await user.click(screen.getByRole('button', { name: '+1' }))

    expect(screen.getByLabelText('Spells cast this turn')).toHaveValue(3)
  })

  it('resets the baseline and its synced counter when toggling back to in-play-at-start', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('checkbox', { name: 'In play at the start of the turn?' }))
    fireEvent.change(screen.getByLabelText('Spells already cast before it entered'), {
      target: { value: '2' },
    })
    // Toggle back -- the baseline field becomes hidden and resets to 0, which cascades
    // to reset the synced counter too.
    await user.click(screen.getByRole('checkbox', { name: 'In play at the start of the turn?' }))

    expect(screen.getByLabelText('Spells cast this turn')).toHaveValue(0)
    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenLastCalledWith(
        'aetherflux-reservoir',
        expect.objectContaining({ spells_already_cast: 0, spells_cast_this_turn: 0 }),
      ),
    )
  })

  it('renders a Pay 50 Life button that tracks activations independently', async () => {
    const user = userEvent.setup()
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Pay 50 Life' }))

    await waitFor(() =>
      expect(api.calculateCard).toHaveBeenLastCalledWith(
        'aetherflux-reservoir',
        expect.objectContaining({ activations_used: 1, spells_cast_this_turn: 0 }),
      ),
    )
  })

  it('disables Pay 50 Life once current life drops below the activation cost', async () => {
    const user = userEvent.setup()
    // First activation succeeds (life 100 -> affordable) and its own response reports
    // the post-payment life (50) -- exactly at the guard boundary, still affordable.
    vi.mocked(api.calculateCard)
      .mockResolvedValueOnce({ outputs: { life_this_spell: 0, total_life: 0, current_life: 100 } })
      .mockResolvedValueOnce({ outputs: { life_this_spell: 0, total_life: 0, current_life: 50 } })
      .mockResolvedValue({ outputs: { life_this_spell: 0, total_life: 0, current_life: 10 } })

    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Pay 50 Life' }))
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeEnabled() // exactly 50 still counts

    await user.click(screen.getByRole('button', { name: 'Pay 50 Life' }))
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('button', { name: 'Pay 50 Life' })).toBeDisabled()
  })

  it('shows an error message when calculation fails', async () => {
    vi.mocked(api.calculateCard).mockRejectedValue(new Error('boom'))
    render(<CardForm card={aetherfluxCard} />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('stringifies a non-Error rejection from calculation', async () => {
    vi.mocked(api.calculateCard).mockRejectedValue('boom')
    render(<CardForm card={aetherfluxCard} />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('prevents the default page-reloading form submission (e.g. Enter in a field)', async () => {
    render(<CardForm card={aetherfluxCard} />)
    await waitFor(() => expect(api.calculateCard).toHaveBeenCalledTimes(1))

    const form = document.querySelector('form')
    if (!form) throw new Error('expected a form element to be rendered')
    const submitEvent = createEvent.submit(form)
    fireEvent(form, submitEvent)
    expect(submitEvent.defaultPrevented).toBe(true)
  })
})
