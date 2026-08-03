import type { FieldValues, OutputValues } from '../../types'

/** Mirrors backend/app/cards/kalonian_hydra.py. */
export function compute(inputs: FieldValues): OutputValues {
  const totalPowerBefore = Number(inputs.total_power_before)
  const countersBefore = Number(inputs.counters_before)
  const attacksThisTurn = Number(inputs.attacks_this_turn)

  // Doubling every creature's counters doubles the total, so N attacks multiply the
  // pool by 2**N. Each new counter is +1/+1, so the power gained is exactly the
  // number of counters added -- printed power rides along unchanged.
  //
  // Plain numbers rather than bigint: the declared bounds top out at 999 * 2**6 =
  // 63,936, nowhere near the 2**53 where scute-swarm.ts has to switch.
  const countersAfter = countersBefore * 2 ** attacksThisTurn
  const powerGained = countersAfter - countersBefore

  return {
    counters_after: countersAfter,
    power_gained: powerGained,
    total_power_after: totalPowerBefore + powerGained,
  }
}
