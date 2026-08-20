import type { FieldValues, OutputValues } from '../../types'

const SQUIRRELS_PER_ROLL = 2
const BONUS_ACTIVATIONS_ON_SIX = 2
const DAMAGE_ROLL_LOYALTY_COST = 2

const FACES_SQUIRRELS = new Set(['1', '2'])
const FACES_RETURN = new Set(['3'])
const FACES_DAMAGE = new Set(['4', '5'])

/** Mirrors backend/app/cards/comet_stellar_pup.py. */
export function compute(inputs: FieldValues): OutputValues {
  const adjustment = Number(inputs.loyalty_adjustment)
  let loyalty = Number(inputs.starting_loyalty) + adjustment

  // Enough damage between activations kills him before the die is ever picked up. A
  // plain zero start (no adjustment) is not death -- that is just the field's floor.
  let died = adjustment < 0 && loyalty <= 0
  loyalty = Math.max(0, loyalty)
  // validateInputs guarantees this is an array of declared option values.
  const rolls = inputs.rolls as string[]

  // A planeswalker gets one loyalty activation a turn; every 6 rolled buys two more.
  let activationsGranted = 1
  let damageThisActivation = 0
  let totalDamage = 0
  let squirrelsCreated = 0
  let cardsReturned = 0

  for (const roll of rolls) {
    if (died) {
      // He's already in the graveyard -- anything logged after that never happened, so
      // stop rather than quietly compounding an impossible board state.
      break
    }

    if (FACES_SQUIRRELS.has(roll)) {
      loyalty += 2
      squirrelsCreated += SQUIRRELS_PER_ROLL
      damageThisActivation = 0
    } else if (FACES_RETURN.has(roll)) {
      loyalty = Math.max(0, loyalty - 1)
      cardsReturned += 1
      damageThisActivation = 0
    } else if (FACES_DAMAGE.has(roll)) {
      // The damage is loyalty *before* the -2: the ability deals damage first and
      // removes counters second. Resolving it the other way round is the single
      // easiest mistake to make with this card, and it costs 2 damage every time.
      damageThisActivation = loyalty
      totalDamage += loyalty
      loyalty = Math.max(0, loyalty - DAMAGE_ROLL_LOYALTY_COST)
    } else {
      loyalty += 1
      activationsGranted += BONUS_ACTIVATIONS_ON_SIX
      damageThisActivation = 0
    }

    if (loyalty <= 0) died = true
  }

  return {
    loyalty,
    // Forced to 0 once he's dead so the roll button's guard disables it, rather than
    // offering activations of a permanent no longer on the battlefield.
    activations_remaining: died ? 0 : activationsGranted - rolls.length,
    damage_this_activation: damageThisActivation,
    total_damage: totalDamage,
    squirrels_created: squirrelsCreated,
    cards_returned: cardsReturned,
    comet_died: died,
  }
}
