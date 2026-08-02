import { useCallback, useEffect, useRef, useState } from 'react'
import { computeCard } from './compute'
import { playLoseSound } from './sound'
import type { CardMetadata, FieldValues, OutputValues } from './types'
import { defaultValues, resolveAlertMessage, withDerivedValues } from './cardModel'
import { getJSON, setJSON } from './storage'

const PENDING_DELAY_MS = 250
const RECALC_DEBOUNCE_MS = 200
const SETUP_CONFIRMED_KEY = 'mtg-calc-setup-confirmed'

function isSetupConfirmed(cardId: string): boolean {
  return getJSON<Record<string, boolean>>(SETUP_CONFIRMED_KEY, {})[cardId] === true
}

function persistSetupConfirmed(cardId: string): void {
  const current = getJSON<Record<string, boolean>>(SETUP_CONFIRMED_KEY, {})
  setJSON(SETUP_CONFIRMED_KEY, { ...current, [cardId]: true })
}

export interface CardSession {
  values: FieldValues
  outputs: OutputValues | null
  pending: boolean
  error: string | null
  alertMessage: string | null
  setupConfirmed: boolean
  setField: (name: string, value: unknown) => void
  resetTurn: () => void
  confirmSetup: () => void
}

/**
 * Owns one card's live state: field values, the most recent calculate() result, and
 * whether this card's setup has been confirmed this session (SetupSheet reads
 * `setupConfirmed` to decide whether to auto-open -- screen-spec.md rule 4). Stays
 * server-authoritative (compute() lives once, in the backend) but fixes the plumbing
 * gaps the old fire-on-every-keystroke CardForm had:
 *  - requests are sequenced (a monotonic id + AbortController), so a slow response to
 *    an older change can never overwrite the result of a newer one
 *  - the network call is debounced 200ms from the last change; `values` updates
 *    immediately regardless, so typing or tapping never feels delayed
 *  - the last good `outputs` stay on screen through a recalculation -- `pending` only
 *    flips true once a request has been in flight for 250ms, so a fast round trip
 *    never flickers the stat tiles
 *
 * Reads the current card via `cardRef.current` (updated every render) rather than
 * closing over the `card` param directly, and keys effects/callbacks on `card.id`
 * instead: a caller may legitimately pass a structurally-equal-but-new CardMetadata
 * reference on some render (e.g. a fresh fetch) without that meaning "the user
 * switched cards" -- reinitializing on every such render would fight the very state
 * the mount effect just set, an infinite render loop if it ever happened.
 */
export function useCardSession(card: CardMetadata): CardSession {
  const cardRef = useRef(card)
  cardRef.current = card

  const [values, setValues] = useState<FieldValues>(() => defaultValues(card))
  const [outputs, setOutputs] = useState<OutputValues | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupConfirmed, setSetupConfirmed] = useState(() => isSetupConfirmed(card.id))

  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<number | undefined>(undefined)
  const pendingTimeoutRef = useRef<number | undefined>(undefined)
  const wasAlertActiveRef = useRef(false)

  const runCalculation = useCallback((nextValues: FieldValues) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = ++requestIdRef.current

    // Safe to set unconditionally: this timeout is always cleared (by the next
    // runCalculation call, or by .finally() below) before a stale request could
    // ever reach it, so by the time it fires it can only belong to this request.
    clearTimeout(pendingTimeoutRef.current)
    pendingTimeoutRef.current = setTimeout(() => setPending(true), PENDING_DELAY_MS)

    computeCard(cardRef.current.id, nextValues, controller.signal)
      .then((result) => {
        if (requestIdRef.current !== requestId) return
        setOutputs(result.outputs)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return
        clearTimeout(pendingTimeoutRef.current)
        setPending(false)
      })
  }, [])

  useEffect(() => {
    const initial = defaultValues(cardRef.current)
    setValues(initial)
    setOutputs(null)
    setError(null)
    setSetupConfirmed(isSetupConfirmed(cardRef.current.id))
    wasAlertActiveRef.current = false
    runCalculation(initial)
    return () => {
      abortControllerRef.current?.abort()
      clearTimeout(debounceTimeoutRef.current)
      clearTimeout(pendingTimeoutRef.current)
    }
  }, [card.id, runCalculation])

  const setField = useCallback(
    (name: string, value: unknown) => {
      setValues((previousValues) => {
        const nextValues = withDerivedValues(cardRef.current, previousValues, {
          ...previousValues,
          [name]: value,
        })
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = setTimeout(
          () => runCalculation(nextValues),
          RECALC_DEBOUNCE_MS,
        )
        return nextValues
      })
    },
    [runCalculation],
  )

  const resetTurn = useCallback(() => {
    const reset = defaultValues(cardRef.current)
    clearTimeout(debounceTimeoutRef.current)
    setValues(reset)
    runCalculation(reset)
  }, [runCalculation])

  const confirmSetup = useCallback(() => {
    persistSetupConfirmed(cardRef.current.id)
    setSetupConfirmed(true)
  }, [])

  const alertMessage = resolveAlertMessage(card, outputs)
  const alertActive = alertMessage != null
  // Edge-triggered, not level-triggered: play the sound once when the alert first
  // becomes active, not on every recalculation while it stays active.
  useEffect(() => {
    if (alertActive && !wasAlertActiveRef.current) playLoseSound()
    wasAlertActiveRef.current = alertActive
  }, [alertActive])

  return {
    values,
    outputs,
    pending,
    error,
    alertMessage,
    setupConfirmed,
    setField,
    resetTurn,
    confirmSetup,
  }
}
