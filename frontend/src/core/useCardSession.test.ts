import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import * as sound from '../sound'
import type { CardMetadata, OutputValues } from '../types'
import { useCardSession } from './useCardSession'

vi.mock('../api')
vi.mock('../sound')

const mockedCalculateCard = vi.mocked(api.calculateCard)

function makeCard(overrides: Partial<CardMetadata> = {}): CardMetadata {
  return {
    id: 'test-card',
    name: 'Test Card',
    rules_text: '...',
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
        setup: false,
        short_label: null,
      },
    ],
    outputs: [{ name: 'total', label: 'Total', kind: 'number', short_label: null, primary: true }],
    alert: null,
    ...overrides,
  }
}

/** A promise plus its resolve/reject, so a test can control exactly when a mocked
 * calculateCard call settles -- required to force out-of-order response scenarios. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Promise microtasks (mockResolvedValue, deferred.resolve/reject) settle fine under
// fake timers -- only the debounce/pending setTimeouts need vi.advanceTimersByTime.
// testing-library's `waitFor` polls with a real setInterval, which deadlocks against
// fake timers, so every wait below is `await act(async () => {})` (flush microtasks)
// followed by a direct assertion, never `waitFor`.
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('initial load', () => {
  it('seeds values from field defaults and calculates immediately', async () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    expect(result.current.values).toEqual({ count: 0 })
    expect(mockedCalculateCard).toHaveBeenCalledWith('test-card', { count: 0 }, expect.any(Object))

    await act(async () => {})
    expect(result.current.outputs).toEqual({ total: 0 })
  })
})

describe('setField', () => {
  it('updates values immediately, before the debounce fires', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => result.current.setField('count', 5))
    expect(result.current.values).toEqual({ count: 5 })
    // Only the initial mount calculation has fired so far.
    expect(mockedCalculateCard).toHaveBeenCalledTimes(1)
  })

  it('debounces the network call by 200ms', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => result.current.setField('count', 5))
    act(() => vi.advanceTimersByTime(199))
    expect(mockedCalculateCard).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(1))
    expect(mockedCalculateCard).toHaveBeenCalledTimes(2)
    expect(mockedCalculateCard).toHaveBeenLastCalledWith('test-card', { count: 5 }, expect.any(Object))
  })

  it('collapses rapid changes into a single debounced call using the final value', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => result.current.setField('count', 1))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setField('count', 2))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setField('count', 3))
    act(() => vi.advanceTimersByTime(200))

    // One call for the initial mount, one debounced call for the settled value 3.
    expect(mockedCalculateCard).toHaveBeenCalledTimes(2)
    expect(mockedCalculateCard).toHaveBeenLastCalledWith('test-card', { count: 3 }, expect.any(Object))
  })
})

describe('out-of-order responses', () => {
  it('discards a stale response that resolves after a newer one already did', async () => {
    const first = deferred<{ outputs: OutputValues }>()
    const second = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    // Mount fires the first call; a debounced setField fires the second.
    act(() => result.current.setField('count', 1))
    act(() => vi.advanceTimersByTime(200))
    expect(mockedCalculateCard).toHaveBeenCalledTimes(2)

    // Resolve the newer request first, then the stale one -- the stale result must
    // not clobber it, which is exactly the race the old CardForm was exposed to.
    await act(async () => second.resolve({ outputs: { total: 2 } }))
    expect(result.current.outputs).toEqual({ total: 2 })

    await act(async () => first.resolve({ outputs: { total: 999 } }))
    expect(result.current.outputs).toEqual({ total: 2 })
  })

  it('does not surface a stale error that rejects after a newer response already resolved', async () => {
    const first = deferred<{ outputs: OutputValues }>()
    const second = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => result.current.setField('count', 1))
    act(() => vi.advanceTimersByTime(200))

    await act(async () => second.resolve({ outputs: { total: 2 } }))
    expect(result.current.outputs).toEqual({ total: 2 })

    await act(async () => first.reject(new Error('stale network error')))
    expect(result.current.error).toBeNull()
    expect(result.current.outputs).toEqual({ total: 2 })
  })
})

describe('pending', () => {
  it('stays false while a request resolves quickly', async () => {
    const first = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockReturnValueOnce(first.promise)
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => vi.advanceTimersByTime(100))
    await act(async () => first.resolve({ outputs: { total: 0 } }))
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.pending).toBe(false)
  })

  it('becomes true once a request has been in flight for 250ms', () => {
    const first = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockReturnValueOnce(first.promise)
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))

    act(() => vi.advanceTimersByTime(250))
    expect(result.current.pending).toBe(true)
  })

  it('clears back to false once the slow request settles, keeping the last outputs', async () => {
    const first = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockResolvedValueOnce({ outputs: { total: 1 } }).mockReturnValueOnce(first.promise)
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))
    await act(async () => {})
    expect(result.current.outputs).toEqual({ total: 1 })

    act(() => result.current.setField('count', 5))
    act(() => vi.advanceTimersByTime(200)) // fire the debounced call
    act(() => vi.advanceTimersByTime(250)) // now it's slow
    expect(result.current.pending).toBe(true)
    expect(result.current.outputs).toEqual({ total: 1 })

    await act(async () => first.resolve({ outputs: { total: 5 } }))
    expect(result.current.pending).toBe(false)
    expect(result.current.outputs).toEqual({ total: 5 })
  })
})

describe('resetTurn', () => {
  it('resets values to defaults and recalculates, without touching setupConfirmed', async () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const { result } = renderHook(() => useCardSession(card))
    await act(async () => {})
    expect(result.current.outputs).toEqual({ total: 0 })

    act(() => result.current.setField('count', 7))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.confirmSetup())
    expect(result.current.setupConfirmed).toBe(true)

    act(() => result.current.resetTurn())
    expect(result.current.values).toEqual({ count: 0 })
    expect(result.current.setupConfirmed).toBe(true)
    expect(mockedCalculateCard).toHaveBeenLastCalledWith('test-card', { count: 0 }, expect.any(Object))
  })
})

describe('setupConfirmed', () => {
  it('defaults to false for a card with no stored confirmation', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const { result } = renderHook(() => useCardSession(makeCard()))
    expect(result.current.setupConfirmed).toBe(false)
  })

  it('persists confirmSetup so a later session for the same card reads it back', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const card = makeCard()
    const first = renderHook(() => useCardSession(card))
    act(() => first.result.current.confirmSetup())
    first.unmount()

    const second = renderHook(() => useCardSession(card))
    expect(second.result.current.setupConfirmed).toBe(true)
  })

  it('does not leak confirmation across different card ids', () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const cardA = makeCard({ id: 'card-a' })
    const cardB = makeCard({ id: 'card-b' })
    const a = renderHook(() => useCardSession(cardA))
    act(() => a.result.current.confirmSetup())

    const b = renderHook(() => useCardSession(cardB))
    expect(b.result.current.setupConfirmed).toBe(false)
  })
})

describe('alert / lose sound edge trigger', () => {
  it('exposes the alert message only when the alert output is true', async () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0, game_lost: true } })
    const card = makeCard({ alert: { output: 'game_lost', message: 'You lose' } })
    const { result } = renderHook(() => useCardSession(card))
    await act(async () => {})
    expect(result.current.alertMessage).toBe('You lose')
  })

  it('fires the lose sound once on the false-to-true edge, not again while it stays true', async () => {
    const responses = [
      { outputs: { total: 0, game_lost: false } },
      { outputs: { total: 0, game_lost: true } },
      { outputs: { total: 0, game_lost: true } },
    ]
    mockedCalculateCard.mockImplementation(() => Promise.resolve(responses.shift()!))
    const card = makeCard({ alert: { output: 'game_lost', message: 'You lose' } })
    const { result } = renderHook(() => useCardSession(card))
    await act(async () => {})
    expect(result.current.alertMessage).toBeNull()

    act(() => result.current.setField('count', 1))
    await act(async () => vi.advanceTimersByTime(200))
    expect(result.current.alertMessage).toBe('You lose')
    expect(sound.playLoseSound).toHaveBeenCalledTimes(1)

    act(() => result.current.setField('count', 2))
    await act(async () => vi.advanceTimersByTime(200))
    expect(mockedCalculateCard).toHaveBeenCalledTimes(3)
    expect(result.current.alertMessage).toBe('You lose')
    expect(sound.playLoseSound).toHaveBeenCalledTimes(1)
  })

  it('does not evaluate an alert for a card that declares none', async () => {
    mockedCalculateCard.mockResolvedValue({ outputs: { total: 0 } })
    const { result } = renderHook(() => useCardSession(makeCard({ alert: null })))
    await act(async () => {})
    expect(result.current.outputs).toEqual({ total: 0 })
    expect(result.current.alertMessage).toBeNull()
    expect(sound.playLoseSound).not.toHaveBeenCalled()
  })
})

describe('error handling', () => {
  it('surfaces a genuine calculation error', async () => {
    mockedCalculateCard.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useCardSession(makeCard()))
    await act(async () => {})
    expect(result.current.error).toBe('boom')
  })

  it('stringifies a non-Error rejection', async () => {
    mockedCalculateCard.mockRejectedValueOnce('plain string failure')
    const { result } = renderHook(() => useCardSession(makeCard()))
    await act(async () => {})
    expect(result.current.error).toBe('plain string failure')
  })
})

describe('unmount', () => {
  it('aborts the in-flight request and does not throw when it later settles', async () => {
    const first = deferred<{ outputs: OutputValues }>()
    mockedCalculateCard.mockReturnValueOnce(first.promise)
    const { unmount } = renderHook(() => useCardSession(makeCard()))

    unmount()
    await expect(act(async () => first.reject(new Error('too late')))).resolves.toBeUndefined()
  })
})
