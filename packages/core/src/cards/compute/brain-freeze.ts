import { totalCopies } from '../storm'
import type { FieldValues, OutputValues } from '../../types'

const CARDS_MILLED_PER_COPY = 3

/** Mirrors backend/app/cards/brain_freeze.py. */
export function compute(inputs: FieldValues): OutputValues {
  const stormCount = Number(inputs.storm_count)
  const librarySize = Number(inputs.target_library_size)

  const resolutions = totalCopies(stormCount)
  // Every copy may be redirected to a different player, so this total only lands on
  // one library if the player keeps every copy pointed at the same target.
  const cardsMilled = resolutions * CARDS_MILLED_PER_COPY

  return {
    copies_from_storm: stormCount,
    total_copies: resolutions,
    cards_milled: cardsMilled,
    library_after: Math.max(0, librarySize - cardsMilled),
    // Emptying a library isn't itself lethal -- they lose the next time they'd draw
    // from it. Still the number everyone leans over the table to see.
    mills_out: cardsMilled >= librarySize,
  }
}
