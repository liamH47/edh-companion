import { totalCopies } from '../storm'
import type { FieldValues, OutputValues } from '../../types'

const LIFE_PER_COPY = 2

/** Mirrors backend/app/cards/tendrils_of_agony.py. */
export function compute(inputs: FieldValues): OutputValues {
  const stormCount = Number(inputs.storm_count)
  const targetLife = Number(inputs.target_life)

  const resolutions = totalCopies(stormCount)
  // Only lands entirely on one player if every copy keeps the same target -- copies
  // may each be redirected, which is why this is shown separately from the gain.
  const lifeDrained = resolutions * LIFE_PER_COPY

  return {
    copies_from_storm: stormCount,
    total_copies: resolutions,
    life_drained: lifeDrained,
    // The gain half doesn't target, so the controller banks the full amount however
    // the losses were spread around the table.
    life_gained: lifeDrained,
    target_life_after: Math.max(0, targetLife - lifeDrained),
    is_lethal: lifeDrained >= targetLife,
  }
}
