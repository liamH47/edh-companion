import type { FieldValues, OutputValues } from '../../types'

/** Mirrors backend/app/cards/craterhoof_behemoth.py. */
export function compute(inputs: FieldValues): OutputValues {
  const totalPowerBefore = Number(inputs.total_power_before_triggers)
  const creatureCount = Number(inputs.creature_count)
  const triggers = Number(inputs.triggers)
  const addedPerTrigger = Number(inputs.creatures_added_per_trigger)

  // X for each trigger in turn. The first resolves against the board as it stands;
  // each later one against a board that has grown by `addedPerTrigger`.
  const bonuses = Array.from(
    { length: triggers },
    (_unused, step) => creatureCount + step * addedPerTrigger,
  )

  // Each trigger's X is squared into the total independently -- X creatures each
  // gaining +X power adds X*X to the sum, regardless of what any other trigger did.
  const powerAdded = bonuses.reduce((sum, bonus) => sum + bonus ** 2, 0)

  return {
    total_power_after_triggers: totalPowerBefore + powerAdded,
    power_added: powerAdded,
    // Every trigger pumps every creature, so a creature present for all of them gained
    // the sum of the X values -- not the largest one.
    pump_per_creature: bonuses.reduce((sum, bonus) => sum + bonus, 0),
    last_trigger_bonus: bonuses[bonuses.length - 1],
  }
}
