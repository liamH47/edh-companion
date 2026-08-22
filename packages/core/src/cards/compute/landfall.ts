import { buildLines, type Source } from '../effects'
import type { FieldValues, OutputValues } from '../../types'

/** Mirrors `_SOURCES`. Insertion order is the option order, which is the order the
 * picker lists them in -- keep it in step with the Python side. */
const SOURCES: Record<string, Source> = {
  'lotus-cobra': {
    label: 'Lotus Cobra',
    effect: 'Add one mana of any color',
    totals: [['mana', 1]],
  },
  'nissa-resurgent-animist': {
    label: 'Nissa, Resurgent Animist',
    effect: 'Add one mana of any color (2nd resolution digs for an Elf or Elemental)',
    totals: [['mana', 1]],
    rider: '2nd resolution dug for an Elf or Elemental',
  },
  'tatyova-benthic-druid': {
    label: 'Tatyova, Benthic Druid',
    effect: 'Gain 1 life and draw a card',
    totals: [
      ['life', 1],
      ['cards', 1],
    ],
  },
  'aesi-tyrant-of-gyre-strait': {
    label: 'Aesi, Tyrant of Gyre Strait',
    effect: 'May draw a card',
    totals: [['cards', 1]],
  },
  'courser-of-kruphix': {
    label: 'Courser of Kruphix',
    effect: 'Gain 1 life',
    totals: [['life', 1]],
  },
  'druid-class': {
    label: 'Druid Class',
    effect: 'Gain 1 life',
    totals: [['life', 1]],
  },
  'primeval-bounty': {
    label: 'Primeval Bounty',
    effect: 'Gain 3 life',
    totals: [['life', 3]],
  },
  'tannuk-memorial-ensign': {
    label: 'Tannuk, Memorial Ensign',
    effect: '1 damage to each opponent (2nd resolution also draws)',
    totals: [['damage_each', 1]],
    rider: '2nd resolution drew a card',
    riderTotals: [['cards', 1]],
  },
  'tunneling-geopede': {
    label: 'Tunneling Geopede',
    effect: '1 damage to each opponent',
    totals: [['damage_each', 1]],
  },
  sabotender: {
    label: 'Sabotender',
    effect: '1 damage to each opponent',
    totals: [['damage_each', 1]],
  },
  'iridescent-vinelasher': {
    label: 'Iridescent Vinelasher',
    effect: '1 damage to target opponent',
    totals: [['damage_one', 1]],
  },
  'ob-nixilis-the-fallen': {
    label: 'Ob Nixilis, the Fallen',
    effect: 'May drain a player for 3, then grow by three +1/+1 counters',
    totals: [
      ['life_loss', 3],
      ['counters', 3],
    ],
  },
  'rampaging-baloths': {
    label: 'Rampaging Baloths',
    effect: 'Create a 4/4 green Beast',
    totals: [['tokens', 1]],
  },
  'zendikars-roil': {
    label: "Zendikar's Roil",
    effect: 'Create a 2/2 green Elemental',
    totals: [['tokens', 1]],
  },
  'omnath-locus-of-rage': {
    label: 'Omnath, Locus of Rage',
    effect: 'Create a 5/5 red and green Elemental',
    totals: [['tokens', 1]],
  },
  'greensleeves-maro-sorcerer': {
    label: 'Greensleeves, Maro-Sorcerer',
    effect: 'Create a 3/3 green Badger',
    totals: [['tokens', 1]],
  },
  'emeria-angel': {
    label: 'Emeria Angel',
    effect: 'May create a 1/1 white Bird with flying',
    totals: [['tokens', 1]],
  },
  'tireless-provisioner': {
    label: 'Tireless Provisioner',
    effect: 'Create a Food or a Treasure token',
    totals: [['tokens', 1]],
  },
  'tireless-tracker': {
    label: 'Tireless Tracker',
    effect: 'Investigate (a Clue token)',
    totals: [['tokens', 1]],
  },
  'scute-swarm': {
    label: 'Scute Swarm',
    effect: 'Create a 1/1 Insect -- a copy of itself instead once you control six lands',
    totals: [['tokens', 1]],
  },
  'bristly-bill-spine-sower': {
    label: 'Bristly Bill, Spine Sower',
    effect: 'Put a +1/+1 counter on target creature',
    totals: [['counters', 1]],
  },
  'scythecat-cub': {
    label: 'Scythecat Cub',
    effect: 'Put a +1/+1 counter on target creature (2nd resolution doubles instead)',
    totals: [['counters', 1]],
    rider: "2nd resolution doubled that creature's counters instead",
  },
  'hedron-crab': {
    label: 'Hedron Crab',
    effect: 'Target player mills three',
    totals: [['mill_one', 3]],
  },
  'ruin-crab': {
    label: 'Ruin Crab',
    effect: 'Each opponent mills three',
    totals: [['mill_each', 3]],
  },
  'icetill-explorer': {
    label: 'Icetill Explorer',
    effect: 'Mill a card',
    totals: [['mill_self', 1]],
  },
  'evolution-sage': {
    label: 'Evolution Sage',
    effect: 'Proliferate',
  },
  'moraug-fury-of-akoum': {
    label: 'Moraug, Fury of Akoum',
    effect: "An extra combat phase, if it's your main phase",
  },
  bloodghast: {
    label: 'Bloodghast',
    effect: 'May return it from your graveyard to the battlefield',
  },
  'valakut-exploration': {
    label: 'Valakut Exploration',
    effect: 'Exile the top card; you may play it while it remains exiled',
  },
}

/** Mirrors `_AGGREGATES`: which totals roll up into which output. */
const AGGREGATES: Record<string, string> = {
  cards_drawn: 'cards',
  life_gained: 'life',
  damage_each_opponent: 'damage_each',
  tokens_created: 'tokens',
}

const SECOND_RESOLUTION = 2

/** Mirrors backend/app/cards/landfall.py. */
export function compute(inputs: FieldValues): OutputValues {
  const sources = (inputs.sources as unknown[]).map(String)
  const triggersPerLand = Number(inputs.triggers_per_land)
  const landsThisTurn = Number(inputs.lands_this_turn)

  // How many times each *individual* ability resolves this turn. A second copy of a
  // card is a second ability, not a bigger one -- which is why the rider fires per copy
  // rather than once for the whole roster (buildLines handles that).
  const perAbility = landsThisTurn * triggersPerLand

  const { lines, aggregate } = buildLines(SOURCES, sources, perAbility, {
    // "The second time this ability has resolved this turn" -- the turn's second land
    // drop, and never again however many more lands follow.
    riderThreshold: SECOND_RESOLUTION,
    forecastNote: 'on your next land',
  })

  const rolled: OutputValues = {}
  for (const [output, category] of Object.entries(AGGREGATES)) {
    rolled[output] = aggregate[category] ?? 0
  }

  return {
    effects: lines,
    triggers: perAbility * sources.length,
    ...rolled,
  }
}
