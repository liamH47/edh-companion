import { buildLines, type Source } from '../effects'
import { totalCopies } from '../storm'
import type { FieldValues, OutputValues } from '../../types'

/** Mirrors `_SOURCES` in backend/app/cards/storm_payoffs.py. Insertion order is the
 * option order, which is the order the picker lists them in -- keep it in step. */
const SOURCES: Record<string, Source> = {
  grapeshot: {
    label: 'Grapeshot',
    effect: '1 damage to any target',
    totals: [['damage_one', 1]],
  },
  'brain-freeze': {
    label: 'Brain Freeze',
    effect: 'Target player mills three',
    totals: [['mill_one', 3]],
  },
  'tendrils-of-agony': {
    label: 'Tendrils of Agony',
    effect: 'Target player loses 2 life, you gain 2',
    totals: [
      ['life_loss', 2],
      ['life', 2],
    ],
  },
  'empty-the-warrens': {
    label: 'Empty the Warrens',
    effect: 'Create two 1/1 red Goblins',
    totals: [['tokens', 2]],
  },
  chatterstorm: {
    label: 'Chatterstorm',
    effect: 'Create a 1/1 green Squirrel',
    totals: [['tokens', 1]],
  },
  'hunting-pack': {
    label: 'Hunting Pack',
    effect: 'Create a 4/4 green Beast',
    totals: [['tokens', 1]],
  },
  'crow-storm': {
    label: 'Crow Storm',
    effect: 'Create a 1/2 blue Bird named Storm Crow',
    totals: [['tokens', 1]],
  },
  'elemental-eruption': {
    label: 'Elemental Eruption',
    effect: 'Create a 4/4 red Dragon Elemental with flying and prowess',
    totals: [['tokens', 1]],
  },
  'weather-the-storm': {
    label: 'Weather the Storm',
    effect: 'Gain 3 life',
    totals: [['life', 3]],
  },
  scattershot: {
    label: 'Scattershot',
    effect: '1 damage to target creature',
    totals: [['damage_one', 1]],
  },
  flusterstorm: {
    label: 'Flusterstorm',
    effect: 'Counter target instant or sorcery unless its controller pays {1}',
  },
  'hindering-touch': {
    label: 'Hindering Touch',
    effect: 'Counter target spell unless its controller pays {2}',
  },
  'temporal-fissure': {
    label: 'Temporal Fissure',
    effect: "Return target permanent to its owner's hand",
  },
  'wing-shards': {
    label: 'Wing Shards',
    effect: 'Target player sacrifices an attacking creature',
  },
  'volcanic-awakening': {
    label: 'Volcanic Awakening',
    effect: 'Destroy target land',
  },
  'ground-rift': {
    label: 'Ground Rift',
    effect: "Target creature without flying can't block this turn",
  },
  dragonstorm: {
    label: 'Dragonstorm',
    effect: 'Search your library for a Dragon and put it onto the battlefield',
  },
  'minds-desire': {
    label: "Mind's Desire",
    effect: 'Exile the top card; you may play it free this turn',
  },
  'galvanic-relay': {
    label: 'Galvanic Relay',
    effect: 'Exile the top card; you may play it next turn',
  },
  'sprouting-vines': {
    label: 'Sprouting Vines',
    effect: 'Search your library for a basic land, into your hand',
  },
  'reaping-the-graves': {
    label: 'Reaping the Graves',
    effect: 'Return target creature card from your graveyard to your hand',
  },
  'ignite-memories': {
    label: 'Ignite Memories',
    effect: 'Damage equal to the mana value of a card revealed at random from their hand',
  },
  'storm-of-memories': {
    label: 'Storm of Memories',
    effect: 'Exile a cheap instant or sorcery from your graveyard at random and cast it free',
  },
  radstorm: {
    label: 'Radstorm',
    effect: 'Proliferate',
  },
  'haze-of-rage': {
    label: 'Haze of Rage',
    effect: 'Creatures you control get +1/+0 until end of turn',
  },
  'astral-steel': {
    label: 'Astral Steel',
    effect: 'Target creature gets +1/+2 until end of turn',
  },
  'spreading-insurrection': {
    label: 'Spreading Insurrection',
    effect: "Gain control of target creature you don't control, untapped and hasty",
  },
  'mordor-on-the-march': {
    label: 'Mordor on the March',
    effect: 'Exile a creature from your graveyard and copy it, hasty until end of turn',
  },
}

/** Mirrors `_AGGREGATES`. */
const AGGREGATES: Record<string, string> = {
  damage_dealt: 'damage_one',
  tokens_created: 'tokens',
}

/** Mirrors backend/app/cards/storm_payoffs.py. */
export function compute(inputs: FieldValues): OutputValues {
  const payoffs = (inputs.payoffs as unknown[]).map(String)
  const stormCount = Number(inputs.storm_count)

  // Every payoff resolves the same number of times: its copies plus the original.
  const resolutions = totalCopies(stormCount)

  // No forecast note: a storm spell always resolves at least once, so there is no
  // "nothing has happened yet" state for a payoff to describe.
  const { lines, aggregate } = buildLines(SOURCES, payoffs, resolutions)

  const rolled: OutputValues = {}
  for (const [output, category] of Object.entries(AGGREGATES)) {
    rolled[output] = aggregate[category] ?? 0
  }

  return {
    effects: lines,
    copies_from_storm: stormCount,
    total_copies: resolutions,
    ...rolled,
  }
}
