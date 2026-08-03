import type { FieldValues, OutputValues } from '../../types'

const LANDFALL_THRESHOLD = 6

/**
 * Mirrors backend/app/cards/scute_swarm.py.
 *
 * Computed in `bigint` rather than `number`. The current bounds cap the answer near
 * 400,000, so this is no longer load-bearing -- but the doubling is exactly the shape
 * where loosening a bound silently reintroduces the problem, and it once did: the card
 * shipped allowing 999,999,999 copies over 99 land drops, about 2^129, which Python
 * computed exactly while a JavaScript `number` drifted.
 *
 * Three `n` suffixes to make that failure mode unreachable is a fair trade. Converting
 * with `Number()` only at the return boundary is what keeps the two implementations in
 * agreement rather than merely close, and summing `total_power` in bigint *before*
 * converting matters for the same reason -- converting each side first rounds twice.
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
