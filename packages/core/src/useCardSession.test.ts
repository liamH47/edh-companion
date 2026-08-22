/**
 * @vitest-environment jsdom
 *
 * This package runs on node by default -- almost all of it is pure. React hooks need
 * somewhere to render, so they opt in here rather than making every other file pay for
 * a DOM it never touches.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetComputeBackend, setComputeBackend } from './compute'
import { setSoundBackend } from './sound'
import { resetStorageBackend, setJSON } from './storage'
import type { CardMetadata, FieldValues } from './types'
import { useCardSession } from './useCardSession'

/**
 * Compute is local and synchronous now, so this file lost a lot: the debounce,
 * request sequencing and delayed `pending` flag it used to verify existed only to hide
 * a network round trip, and none of them survive. What is left is the behaviour that
 * was always the point -- values, outputs, setup confirmation, and the alert edge.
 */
const compute = vi.fn()
const soundBackend = { playWin: vi.fn(), playLose: vi.fn(), playRoll: vi.fn() }

function makeCard(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'test-card',
    name: 'Test Card',
    rules_text: '...',
    scryfall_id: null,
    show_hero_art: false,
    resets_on_new_turn: true,
    fields: [
      {
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
        roll: null,
    map: null,
    picker: null,
    mana: null,
    persists_across_turns: false,
    new_turn_carries_output: null,
        setup: false,
        short_label: null,
      },
    ],
    outputs: [{
        name: 'total',
        label: 'Total',
        kind: 'number',
        short_label: null,
        primary: true,
        hero_shape: 'number',
        hidden: false,
      }],
    alert: null,
    ...overrides,
  }
}

beforeEach(() => {
  resetStorageBackend()
  compute.mockReset()
  compute.mockReturnValue({ total: 0 })
  setComputeBackend(compute)
  soundBackend.playWin.mockReset()
  soundBackend.playLose.mockReset()
  setSoundBackend(soundBackend)
})

afterEach(() => {
  resetComputeBackend()
  vi.clearAllMocks()
})

describe('initial load', () => {
  it('seeds values from field defaults and computes immediately', () => {
    compute.mockReturnValue({ total: 5 })
    const { result } = renderHook(() => useCardSession(makeCard()))

    expect(result.current.values).toEqual({ count: 0 })
    // No wait, no flush: outputs are there on the first render.
    expect(result.current.outputs).toEqual({ total: 5 })
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('never reports pending, because nothing is ever in flight', () => {
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.pending).toBe(false)
  })
})

describe('setField', () => {
  it('updates values and outputs together', () => {
    compute.mockImplementation((_card, inputs) => ({ total: Number(inputs.count) * 2 }))
    const { result } = renderHook(() => useCardSession(makeCard()))

    act(() => result.current.setField('count', 4))

    expect(result.current.values).toEqual({ count: 4 })
    expect(result.current.outputs).toEqual({ total: 8 })
  })

  it('recomputes on every change, with no debounce to collapse them', () => {
    const { result } = renderHook(() => useCardSession(makeCard()))
    compute.mockClear()

    act(() => result.current.setField('count', 1))
    act(() => result.current.setField('count', 2))
    act(() => result.current.setField('count', 3))

    expect(compute).toHaveBeenCalledTimes(3)
    expect(result.current.values).toEqual({ count: 3 })
  })
})

describe('resetTurn', () => {
  it('resets values to defaults and recomputes, without touching setupConfirmed', () => {
    const { result } = renderHook(() => useCardSession(makeCard()))
    act(() => result.current.confirmSetup())
    act(() => result.current.setField('count', 7))

    act(() => result.current.resetTurn())

    expect(result.current.values).toEqual({ count: 0 })
    expect(result.current.setupConfirmed).toBe(true)
  })

  it('carries a flagged field over from the output it names, clamped to its bounds', () => {
    const card = makeCard()
    card.fields[0].new_turn_carries_output = 'total'
    compute.mockReturnValue({ total: 12 })
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.setField('count', 7))

    act(() => result.current.resetTurn())
    // The walker keeps what it ended the turn with, not the default.
    expect(result.current.values).toEqual({ count: 12 })

    // A runaway output is clamped to the field's own max rather than poisoning the
    // next turn's validation.
    compute.mockReturnValue({ total: 500 })
    act(() => result.current.setField('count', 1))
    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: 99 })
  })

  it('carries without clamping when the field declares no bounds', () => {
    const card = makeCard()
    card.fields[0].new_turn_carries_output = 'total'
    card.fields[0].min = null
    card.fields[0].max = null
    compute.mockReturnValue({ total: -3 })
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: -3 })
  })

  it('skips the carry when no computation has ever succeeded', () => {
    const card = makeCard()
    card.fields[0].new_turn_carries_output = 'total'
    compute.mockImplementation(() => {
      throw new Error('boom')
    })
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: 0 })
  })

  it('falls back to the default when the carried output is not a number', () => {
    const card = makeCard()
    card.fields[0].new_turn_carries_output = 'total'
    compute.mockReturnValue({ total: true })
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.setField('count', 7))
    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: 0 })
  })

  it('leaves a persists_across_turns field exactly as it was', () => {
    // Board state a turn boundary doesn't touch: the landfall permanents you control
    // are still there next turn. Unlike a carry-over this takes no computed value --
    // it just keeps what's there, which is the only thing that works for a list.
    const card = makeCard()
    card.fields[0].persists_across_turns = true
    card.fields[0].max = null
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.setField('count', 7))

    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: 7 })
  })

  it('resets the fields around a persisting one', () => {
    const card = makeCard()
    card.fields = [
      { ...card.fields[0], name: 'roster', persists_across_turns: true, default: [] },
      { ...card.fields[0], name: 'lands', default: 0 },
    ]
    const { result } = renderHook(() => useCardSession(card))
    act(() => result.current.setField('roster', ['lotus-cobra']))
    act(() => result.current.setField('lands', 3))

    act(() => result.current.resetTurn())
    // The roster survives the turn; the per-turn tally does not.
    expect(result.current.values).toEqual({ roster: ['lotus-cobra'], lands: 0 })
  })
})

describe('persistence', () => {
  it('hydrates a later session from what the last one stored', () => {
    compute.mockReturnValue({ total: 5 })
    const first = renderHook(() => useCardSession(makeCard()))
    act(() => first.result.current.setField('count', 42))
    first.unmount()

    // A fresh mount of the same card (same storage) picks the value back up --
    // mid-dungeon state survives a reload.
    const second = renderHook(() => useCardSession(makeCard()))
    expect(second.result.current.values).toEqual({ count: 42 })
  })

  it('drops stored keys the card no longer declares', () => {
    compute.mockReturnValue({ total: 5 })
    setJSON('mtg-calc-card-values', { 'test-card': { count: 7, ghost: 99 } })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.values).toEqual({ count: 7 })
  })

  it('backfills a stored session missing a newer field with its default', () => {
    compute.mockReturnValue({ total: 5 })
    setJSON('mtg-calc-card-values', { 'test-card': { ghost: 99 } })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.values).toEqual({ count: 0 })
  })

  it('falls back to defaults when the stored state no longer computes', () => {
    setJSON('mtg-calc-card-values', { 'test-card': { count: 7 } })
    // A schema change since the save: the stored shape now always throws (hydration
    // probes it once per mount and once per card switch). The player gets defaults,
    // not an error banner.
    compute.mockImplementation((_card: CardMetadata, inputs: FieldValues) => {
      if (inputs.count === 7) throw new Error('stale shape')
      return { total: 5 }
    })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.values).toEqual({ count: 0 })
    expect(result.current.error).toBeNull()
  })

  it('starts from defaults when nothing is stored', () => {
    compute.mockReturnValue({ total: 5 })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.values).toEqual({ count: 0 })
  })
})

describe('setupConfirmed', () => {
  it('defaults to false for a card with no stored confirmation', () => {
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.setupConfirmed).toBe(false)
  })

  it('persists confirmSetup so a later session for the same card reads it back', () => {
    const first = renderHook(() => useCardSession(makeCard()))
    act(() => first.result.current.confirmSetup())
    first.unmount()

    const second = renderHook(() => useCardSession(makeCard()))
    expect(second.result.current.setupConfirmed).toBe(true)
  })

  it('does not leak confirmation across different card ids', () => {
    const first = renderHook(() => useCardSession(makeCard({ id: 'card-a' })))
    act(() => first.result.current.confirmSetup())
    first.unmount()

    const second = renderHook(() => useCardSession(makeCard({ id: 'card-b' })))
    expect(second.result.current.setupConfirmed).toBe(false)
  })
})

describe('alert and the lose-sound edge', () => {
  const alertCard = makeCard({ alert: { output: 'game_lost', message: 'You lose', tone: 'danger' } })

  it('exposes the alert message only when the alert output is true', () => {
    compute.mockReturnValue({ total: 0, game_lost: false })
    const { result, rerender } = renderHook(() => useCardSession(alertCard))
    expect(result.current.alertMessage).toBeNull()

    compute.mockReturnValue({ total: 0, game_lost: true })
    act(() => result.current.setField('count', 1))
    rerender()

    expect(result.current.alertMessage).toBe('You lose')
  })

  it('fires the lose sound once on the false-to-true edge, not again while it stays true', () => {
    compute.mockReturnValue({ total: 0, game_lost: false })
    const { result } = renderHook(() => useCardSession(alertCard))

    compute.mockReturnValue({ total: 0, game_lost: true })
    act(() => result.current.setField('count', 1))
    expect(soundBackend.playLose).toHaveBeenCalledTimes(1)

    // Still true on the next change -- edge-triggered, not level-triggered.
    act(() => result.current.setField('count', 2))
    expect(soundBackend.playLose).toHaveBeenCalledTimes(1)
  })

  it('plays the win sound, not the lose sound, for a success-tone alert', () => {
    const successCard = makeCard({
      alert: { output: 'dungeon_complete', message: 'Dungeon complete', tone: 'success' },
    })
    compute.mockReturnValue({ total: 0, dungeon_complete: false })
    const { result, rerender } = renderHook(() => useCardSession(successCard))

    compute.mockReturnValue({ total: 0, dungeon_complete: true })
    act(() => result.current.setField('count', 1))
    rerender()

    // Completing a dungeon must not sound like losing a coin flip.
    expect(soundBackend.playWin).toHaveBeenCalledTimes(1)
    expect(soundBackend.playLose).not.toHaveBeenCalled()
    expect(result.current.alertTone).toBe('success')
  })

  it('exposes a null tone while no alert is active', () => {
    compute.mockReturnValue({ total: 0, game_lost: false })
    const { result } = renderHook(() => useCardSession(alertCard))
    expect(result.current.alertTone).toBeNull()
  })

  it('does not evaluate an alert for a card that declares none', () => {
    compute.mockReturnValue({ total: 0, game_lost: true })
    const { result } = renderHook(() => useCardSession(makeCard()))

    expect(result.current.alertMessage).toBeNull()
    expect(soundBackend.playLose).not.toHaveBeenCalled()
  })
})

describe('error handling', () => {
  it('surfaces a computation error rather than throwing through the render', () => {
    compute.mockImplementation(() => {
      throw new Error('count must be >= 0')
    })
    const { result } = renderHook(() => useCardSession(makeCard()))

    expect(result.current.error).toBe('count must be >= 0')
  })

  it('stringifies a thrown non-Error', () => {
    compute.mockImplementation(() => {
      throw 'something odd'
    })
    const { result } = renderHook(() => useCardSession(makeCard()))

    expect(result.current.error).toBe('something odd')
  })

  it('clears the error once a later change computes cleanly', () => {
    compute.mockImplementation(() => {
      throw new Error('bad')
    })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.error).toBe('bad')

    compute.mockReturnValue({ total: 1 })
    act(() => result.current.setField('count', 1))

    expect(result.current.error).toBeNull()
    expect(result.current.outputs).toEqual({ total: 1 })
  })
})
