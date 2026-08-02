import type { FieldValues, OutputValues } from '../../types'

const LANDFALL_THRESHOLD = 6

/**
 * Mirrors backend/app/cards/scute_swarm.py.
 *
 * Computed in `bigint`, not `number`, and that is not defensive: the swarm doubles per
 * land drop, and the declared bounds allow 999,999,999 copies with 99 lands played --
 * about 2^129. Python's integers are arbitrary precision and compute that exactly; a
 * JavaScript `number` loses precision above 2^53 and would silently drift.
 *
 * Converting with `Number()` only at the return boundary is what keeps the two in
 * agreement rather than merely close. `Number(bigint)` rounds to the nearest double,
 * and `JSON.parse` of Python's exact decimal rounds to the nearest double too -- so
 * both land on the same value. Summing `total_power` in bigint *before* converting
 * matters for the same reason: converting each side first would round twice.
 */
export function compute(inputs: FieldValues): OutputValues {
  let landCount = BigInt(Number(inputs.current_land_count))
  let swarmCount = BigInt(Number(inputs.scute_swarm_count))
  let insectCount = BigInt(Number(inputs.insect_token_count))
  const landsPlayed = Number(inputs.lands_played)

  // Simulated step by step, not a closed-form sum -- the six-land gate can flip
  // mid-sequence, and each step's trigger count depends on the swarm count so far.
  for (let i = 0; i < landsPlayed; i++) {
    landCount += 1n
    if (landCount >= BigInt(LANDFALL_THRESHOLD)) {
      swarmCount *= 2n
    } else {
      insectCount += swarmCount
    }
  }

  return {
    final_land_count: Number(landCount),
    final_scute_swarm_count: Number(swarmCount),
    final_insect_count: Number(insectCount),
    // Everything on board from this card is a 1/1, so power == body count. Summed in
    // bigint first; adding two already-rounded doubles would not match Python.
    total_power: Number(swarmCount + insectCount),
  }
}
