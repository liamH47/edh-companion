import { totalCopies } from '../storm'
import type { FieldValues, OutputValues } from '../../types'

const DAMAGE_PER_COPY = 1

/** Mirrors backend/app/cards/grapeshot.py. */
export function compute(inputs: FieldValues): OutputValues {
  const stormCount = Number(inputs.storm_count)
  const resolutions = totalCopies(stormCount)

  return {
    copies_from_storm: stormCount,
    total_copies: resolutions,
    total_damage: resolutions * DAMAGE_PER_COPY,
  }
}
