import type { FieldValues, OutputValues } from '../../types'

/** Mirrors backend/app/cards/craterhoof_behemoth.py. */
export function compute(inputs: FieldValues): OutputValues {
  const totalPowerBefore = Number(inputs.total_power_before_triggers)
  const trigger1 = Number(inputs.trigger_1_creature_count)
  const trigger2 = Number(inputs.trigger_2_creature_count)

  // Each trigger's X is squared into the total independently -- X creatures each
  // gaining +X power adds X*X to the sum, regardless of what any other trigger did.
  const afterTrigger1 = totalPowerBefore + trigger1 ** 2
  const afterTrigger2 = afterTrigger1 + trigger2 ** 2

  return {
    power_bonus_trigger_1: trigger1,
    power_after_trigger_1: afterTrigger1,
    power_bonus_trigger_2: trigger2,
    total_power_after_triggers: afterTrigger2,
  }
}
