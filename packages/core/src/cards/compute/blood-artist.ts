import type { FieldValues, OutputValues } from '../../types'

/** Mirrors backend/app/cards/blood_artist.py. */
export function compute(inputs: FieldValues): OutputValues {
  const creaturesDied = Number(inputs.creatures_died)
  const drainEffectCount = Number(inputs.drain_effect_count)

  return {
    // Equals both total life lost by the target(s) and total life gained -- the gain
    // side isn't targeted, so it always lands entirely on the controller.
    total_life_drained: creaturesDied * drainEffectCount,
  }
}
