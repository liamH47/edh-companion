import type { FieldValues, OutputValues } from '../../types'

const BASE_POWER = 3
const COUNTERS_PER_TRIGGER = 3
const LIFE_LOST_PER_TRIGGER = 3

/** Mirrors backend/app/cards/ob_nixilis_the_fallen.py. */
export function compute(inputs: FieldValues): OutputValues {
  const existingCounters = Number(inputs.existing_counters)
  const triggersPerLand = Number(inputs.triggers_per_land)
  const landsThisTurn = Number(inputs.lands_this_turn)

  const landfallTriggers = landsThisTurn * triggersPerLand
  const countersAdded = landfallTriggers * COUNTERS_PER_TRIGGER
  const totalCounters = existingCounters + countersAdded

  return {
    // He's a 3/3 base and the counters are +1/+1, so power and toughness stay equal.
    power: BASE_POWER + totalCounters,
    landfall_triggers: landfallTriggers,
    counters_added: countersAdded,
    total_counters: totalCounters,
    // Each trigger picks its own target, so this is the total drained across the whole
    // table -- not damage any single opponent necessarily took.
    life_drained: landfallTriggers * LIFE_LOST_PER_TRIGGER,
  }
}
