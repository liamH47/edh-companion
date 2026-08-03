import { totalCopies } from '../storm'
import type { FieldValues, OutputValues } from '../../types'

const GOBLINS_PER_COPY = 2
const GOBLIN_POWER = 1

/** Mirrors backend/app/cards/empty_the_warrens.py. */
export function compute(inputs: FieldValues): OutputValues {
  const stormCount = Number(inputs.storm_count)

  const resolutions = totalCopies(stormCount)
  const goblinsCreated = resolutions * GOBLINS_PER_COPY

  return {
    copies_from_storm: stormCount,
    total_copies: resolutions,
    goblins_created: goblinsCreated,
    // They enter without haste, so this is next turn's number, not this turn's --
    // which is the whole reason the count matters when you cast it.
    damage_next_turn: goblinsCreated * GOBLIN_POWER,
  }
}
