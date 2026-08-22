import type { FieldValues, OutputValues } from '../../types'

/** Mirrors backend/app/cards/mana_pool.py. */
export function compute(inputs: FieldValues): OutputValues {
  const pool = (inputs.pool as unknown[]).map(String)

  const colorless = pool.filter((symbol) => symbol === 'C').length

  return {
    total: pool.length,
    // Colorless mana pays a generic cost but can never stand in for a colored pip.
    colored: pool.length - colorless,
    colorless,
    colors_available: new Set(pool.filter((symbol) => symbol !== 'C')).size,
  }
}
