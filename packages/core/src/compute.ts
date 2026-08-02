import { computeFor } from './cards/registry'
import { InputError, validateInputs } from './cards/validation'
import type { CardMetadata, FieldValues, OutputValues } from './types'

/**
 * How a card's outputs get computed, behind a swappable backend.
 *
 * Local and **synchronous** by default. Compute is pure arithmetic over a handful of
 * numbers; the round trip it replaced existed only because the implementation lived on
 * the server. Doing it here means the Cards tab works with no connection -- the same
 * property Swiss and Coin Flip already had -- and results land on the same frame as
 * the tap rather than after a debounce plus a network wait.
 *
 * Still a seam rather than a direct call, because this is the one place worth being
 * able to substitute: a test registers a spy without mocking a module, which matters
 * here since `useCardSession` and the compute it calls live in the same package, and a
 * mock registered from an app resolves to a different module id for the same file.
 */
export type ComputeBackend = (card: CardMetadata, inputs: FieldValues) => OutputValues

const localCompute: ComputeBackend = (card, inputs) =>
  computeFor(card.id)(validateInputs(card.fields, inputs))

let backend: ComputeBackend = localCompute

export function setComputeBackend(next: ComputeBackend): void {
  backend = next
}

/** Restores the default local compute. For tests. */
export function resetComputeBackend(): void {
  backend = localCompute
}

export function computeCard(card: CardMetadata, inputs: FieldValues): OutputValues {
  return backend(card, inputs)
}

export { InputError }
