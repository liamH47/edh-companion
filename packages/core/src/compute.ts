import { calculateCard } from './api'
import type { FieldValues, OutputValues } from './types'

/**
 * How a card's outputs get computed, behind a swappable backend.
 *
 * Defaults to the backend API. Two reasons it is a seam rather than a direct call:
 *
 * - It is the thing that changes when compute moves client-side -- that becomes a
 *   `setComputeBackend` call at startup rather than surgery on `useCardSession`.
 * - It makes the hook testable without mocking a module. Mocking one is genuinely
 *   awkward here: `useCardSession` lives in this package and imports `./api`, so a
 *   mock registered from an app against `@mtg/core/api` resolves to a different module
 *   id for the same file and silently fails to intercept.
 */
export type ComputeBackend = (
  cardId: string,
  inputs: FieldValues,
  signal?: AbortSignal,
) => Promise<{ outputs: OutputValues }>

let backend: ComputeBackend = calculateCard

export function setComputeBackend(next: ComputeBackend): void {
  backend = next
}

/** Restores the default network-backed compute. For tests. */
export function resetComputeBackend(): void {
  backend = calculateCard
}

export function computeCard(
  cardId: string,
  inputs: FieldValues,
  signal?: AbortSignal,
): Promise<{ outputs: OutputValues }> {
  return backend(cardId, inputs, signal)
}
