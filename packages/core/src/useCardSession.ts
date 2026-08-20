import { useCallback, useEffect, useRef, useState } from 'react'
import { computeCard } from './compute'
import { playLoseSound, playWinSound } from './sound'
import type { CardMetadata, FieldValues, OutputValues } from './types'
import { defaultValues, resolveAlertMessage, resolveAlertTone, withDerivedValues } from './cardModel'
import { getJSON, setJSON } from './storage'

const SETUP_CONFIRMED_KEY = 'mtg-calc-setup-confirmed'
const CARD_VALUES_KEY = 'mtg-calc-card-values'

/** Stored field values for this card, merged over its defaults -- only keys the card
 * still declares survive, so a renamed field cannot resurrect a stale value. Returns
 * null when nothing usable is stored or the stored state no longer computes (a schema
 * change since it was saved): the caller falls back to defaults rather than greeting
 * the player with an error banner. */
function hydrateValues(card: CardMetadata): FieldValues | null {
  const stored = getJSON<Record<string, FieldValues>>(CARD_VALUES_KEY, {})[card.id]
  if (!stored) return null
  const merged = { ...defaultValues(card) }
  for (const field of card.fields) {
    if (field.name in stored) merged[field.name] = stored[field.name]
  }
  try {
    computeCard(card, merged)
  } catch {
    return null
  }
  return merged
}

function persistValues(cardId: string, values: FieldValues): void {
  const current = getJSON<Record<string, FieldValues>>(CARD_VALUES_KEY, {})
  setJSON(CARD_VALUES_KEY, { ...current, [cardId]: values })
}

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
  /** The active alert's tone, for banner styling; null while no alert is active. */
  alertTone: 'danger' | 'success' | null
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

  const [values, setValues] = useState<FieldValues>(
    () => hydrateValues(card) ?? defaultValues(card),
  )
  const [outputs, setOutputs] = useState<OutputValues | null>(null)
  // Mirrors `outputs` for callbacks that must read the latest result without keying
  // themselves on it (resetTurn's carry-over) -- same pattern as cardRef.
  const outputsRef = useRef<OutputValues | null>(null)
  outputsRef.current = outputs
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
    // Pick up where the player left off: mid-dungeon state and half-finished turns
    // survive a reload (and a phone browser evicting the tab at a table). Defaults
    // only when nothing usable is stored.
    const initial = hydrateValues(cardRef.current) ?? defaultValues(cardRef.current)
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
    const card = cardRef.current
    const reset = defaultValues(card)
    // Carry-over fields take the output they name instead of their default: a walker
    // keeps the loyalty it ended the turn with. Clamped to the field's own bounds so a
    // runaway output cannot poison the next turn's validation.
    const outputs = outputsRef.current
    for (const field of card.fields) {
      const carried = field.new_turn_carries_output
      if (carried === null || outputs === null) continue
      const value = outputs[carried]
      if (typeof value !== 'number') continue
      let clamped = value
      if (field.min != null) clamped = Math.max(field.min, clamped)
      if (field.max != null) clamped = Math.min(field.max, clamped)
      reset[field.name] = clamped
    }
    setValues(reset)
    runCalculation(reset)
  }, [runCalculation])

  const confirmSetup = useCallback(() => {
    persistSetupConfirmed(cardRef.current.id)
    setSetupConfirmed(true)
  }, [])

  // Persist after every change, keyed by card id. Cheap: 14 cards' worth of small
  // value maps, written through the synchronous storage seam.
  useEffect(() => {
    persistValues(cardRef.current.id, values)
  }, [values])

  const alertMessage = resolveAlertMessage(card, outputs)
  const alertActive = alertMessage != null
  const alertTone = resolveAlertTone(cardRef.current, outputs)
  // Edge-triggered, not level-triggered: play the sound once when the alert first
  // becomes active, not on every recalculation while it stays active. The tone picks
  // the clip -- completing a dungeon must not sound like losing a coin flip.
  const alertToneRef = useRef(alertTone)
  alertToneRef.current = alertTone
  useEffect(() => {
    if (alertActive && !wasAlertActiveRef.current) {
      if (alertToneRef.current === 'success') playWinSound()
      else playLoseSound()
    }
    wasAlertActiveRef.current = alertActive
  }, [alertActive])

  return {
    values,
    outputs,
    // Kept so no screen had to change; local compute is never in flight.
    pending: false,
    error,
    alertMessage,
    alertTone,
    setupConfirmed,
    setField,
    resetTurn,
    confirmSetup,
  }
}
