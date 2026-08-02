import type { FieldValues, OutputValues } from '../../types'

const ACTIVATION_COST = 2

/** Mirrors backend/app/cards/nykthos_shrine_to_nyx.py. */
export function compute(inputs: FieldValues): OutputValues {
  const devotionCount = Number(inputs.devotion_count)

  return {
    mana_produced: devotionCount,
    // Can go negative -- that's the point: it answers "was tapping Nykthos worth it"
    // at a glance, and a negative number is a clear "no."
    net_mana_after_activation_cost: devotionCount - ACTIVATION_COST,
  }
}
