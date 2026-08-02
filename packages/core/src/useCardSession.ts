import { useCallback, useEffect, useRef, useState } from 'react'
import { computeCard } from './compute'
import { playLoseSound } from './sound'
import type { CardMetadata, FieldValues, OutputValues } from './types'
import { defaultValues, resolveAlertMessage, withDerivedValues } from './cardModel'
import { getJSON, setJSON } from './storage'

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
 * Owns one card's live state: field values, the current outputs, and whether this
 * card's setup has been confirmed this session (SetupSheet reads `setupConfirmed` to
 * decide whether to auto-open -- screen-spec.md rule 4).
 *
 * Compute is local and synchronous, so outputs are derived on the same render as the
 * change that caused them. The request sequencing, 200ms debounce and delayed
 * `pending` flag this hook used to carry existed only to hide a network round trip.
 * With nothing to hide they are gone rather than left as machinery nobody could
 * explain. `pending` stays in the interface, always false, so no screen had to change.
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
  const [error, setError] = useState<string | null>(null)
  const [setupConfirmed, setSetupConfirmed] = useState(() => isSetupConfirmed(card.id))

  const wasAlertActiveRef = useRef(false)

  /** Recomputes, turning a validation failure into the error banner rather than
   * letting it throw through the render. */
  const runCalculation = useCallback((nextValues: FieldValues) => {
    try {
      setOutputs(computeCard(cardRef.current, nextValues))
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    const initial = defaultValues(cardRef.current)
    setValues(initial)
    setError(null)
    setSetupConfirmed(isSetupConfirmed(cardRef.current.id))
    wasAlertActiveRef.current = false
    runCalculation(initial)
  }, [card.id, runCalculation])

  const setField = useCallback(
    (name: string, value: unknown) => {
      setValues((previousValues) => {
        const nextValues = withDerivedValues(cardRef.current, previousValues, {
          ...previousValues,
          [name]: value,
        })
        runCalculation(nextValues)
        return nextValues
      })
    },
    [runCalculation],
  )

  const resetTurn = useCallback(() => {
    const reset = defaultValues(cardRef.current)
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
    // Kept so no screen had to change; local compute is never in flight.
    pending: false,
    error,
    alertMessage,
    setupConfirmed,
    setField,
    resetTurn,
    confirmSetup,
  }
}
