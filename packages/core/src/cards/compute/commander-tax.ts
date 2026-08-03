import type { FieldValues, OutputValues } from '../../types'

const TAX_PER_PRIOR_CAST = 2

/** Mirrors backend/app/cards/commander_tax.py. */
export function compute(inputs: FieldValues): OutputValues {
  const base = Number(inputs.base_commander_cost)
  const priorCasts = Number(inputs.times_cast_from_command_zone)
  const reduction = Number(inputs.flat_cost_reduction)

  const tax = TAX_PER_PRIOR_CAST * priorCasts
  // Reductions apply to the whole cost and can't drive it below zero. Everything is
  // treated as generic -- the practical simplification a table wants.
  const currentCastCost = Math.max(0, base + tax - reduction)

  return {
    commander_tax: tax,
    current_cast_cost: currentCastCost,
  }
}
