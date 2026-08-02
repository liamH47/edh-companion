import type { FieldValues, OutputValues } from '../../types'

const ACTIVATION_LIFE_COST = 50

/**
 * How many more spells (cast with the Reservoir in play) until life crosses the next
 * 50-life threshold -- i.e. affords one more activation than is possible now.
 *
 * Always terminates well within a turn's spell cap: `lifeNeeded` is at most 50, and
 * cumulative gain after k spells is at least k(k+1)/2, which clears 50 by k = 10.
 */
function spellsUntilNextActivation(effectiveLife: number, nextSpellGain: number): number {
  const remainder = effectiveLife % ACTIVATION_LIFE_COST
  const lifeNeeded = remainder ? ACTIVATION_LIFE_COST - remainder : ACTIVATION_LIFE_COST

  let cumulative = 0
  let gain = nextSpellGain
  let spellsNeeded = 0
  while (cumulative < lifeNeeded) {
    cumulative += gain
    gain += 1
    spellsNeeded += 1
  }
  return spellsNeeded
}

/** Mirrors backend/app/cards/aetherflux_reservoir.py. */
export function compute(inputs: FieldValues): OutputValues {
  const baseline = inputs.was_in_play_at_turn_start ? 0 : Number(inputs.spells_already_cast)
  const spellsCastThisTurn = Number(inputs.spells_cast_this_turn)
  const startingLife = Number(inputs.starting_life)
  const activationsUsed = Number(inputs.activations_used)

  // spells_cast_this_turn is the running total the player actually sees at the table.
  // Only the portion cast since the Reservoir was in play generates any gain; clamp at
  // 0 in case someone lowers the total below the baseline they set.
  const spellsCastAfter = Math.max(0, spellsCastThisTurn - baseline)

  // The Nth spell cast this turn (counting itself) gains N life, so the spells cast
  // since the Reservoir became active gain baseline+1, baseline+2, ..., baseline+Y.
  const totalLife =
    spellsCastAfter * baseline + Math.floor((spellsCastAfter * (spellsCastAfter + 1)) / 2)
  const lifeThisSpell = spellsCastAfter >= 1 ? baseline + spellsCastAfter : 0

  const damageDealt = activationsUsed * ACTIVATION_LIFE_COST
  const currentLife = startingLife + totalLife - damageDealt
  // Clamped before the threshold math below: a player can record more activations than
  // they had life for, and current_life goes negative to reflect that honestly, but
  // "how many activations remain" bottoms out at 0.
  const effectiveLife = Math.max(0, currentLife)

  const possibleActivations = Math.floor(effectiveLife / ACTIVATION_LIFE_COST)

  return {
    life_this_spell: lifeThisSpell,
    total_life: totalLife,
    current_life: currentLife,
    damage_dealt: damageDealt,
    possible_activations: possibleActivations,
    damage_available: possibleActivations * ACTIVATION_LIFE_COST,
    spells_until_next_activation: spellsUntilNextActivation(
      effectiveLife,
      baseline + spellsCastAfter + 1,
    ),
    // 0 or less life is a state-based loss (most commonly hit by paying the Reservoir's
    // cost at exactly 50 life). Drives a banner rather than another number.
    game_lost: currentLife <= 0,
  }
}
