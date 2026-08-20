import { compute as aetherfluxReservoir } from './compute/aetherflux-reservoir'
import { compute as bloodArtist } from './compute/blood-artist'
import { compute as brainFreeze } from './compute/brain-freeze'
import { compute as cometStellarPup } from './compute/comet-stellar-pup'
import { compute as commanderTax } from './compute/commander-tax'
import { compute as craterhoofBehemoth } from './compute/craterhoof-behemoth'
import { compute as dungeons } from './compute/dungeons'
import { compute as emptyTheWarrens } from './compute/empty-the-warrens'
import { compute as grapeshot } from './compute/grapeshot'
import { compute as kalonianHydra } from './compute/kalonian-hydra'
import { compute as nykthosShrineToNyx } from './compute/nykthos-shrine-to-nyx'
import { compute as obNixilisTheFallen } from './compute/ob-nixilis-the-fallen'
import { compute as scuteSwarm } from './compute/scute-swarm'
import { compute as tendrilsOfAgony } from './compute/tendrils-of-agony'
import type { FieldValues, OutputValues } from '../types'

export type ComputeFn = (inputs: FieldValues) => OutputValues

/**
 * Every card's compute, keyed by the id its Python module declares.
 *
 * Kept alphabetical so adding one is a one-line diff rather than an import-order
 * mystery -- the same convention `backend/app/cards/registry.py` follows.
 *
 * `parity.test.ts` asserts this covers exactly the cards the backend registers, so
 * adding a card in Python and regenerating the corpus turns the suite red until the
 * TypeScript side exists. That forcing function is the point: it is what stops the two
 * implementations drifting apart silently.
 */
export const COMPUTE_BY_CARD_ID: Record<string, ComputeFn> = {
  'aetherflux-reservoir': aetherfluxReservoir,
  'blood-artist': bloodArtist,
  'brain-freeze': brainFreeze,
  'comet-stellar-pup': cometStellarPup,
  'commander-tax': commanderTax,
  'craterhoof-behemoth': craterhoofBehemoth,
  dungeons: dungeons,
  'empty-the-warrens': emptyTheWarrens,
  grapeshot,
  'kalonian-hydra': kalonianHydra,
  'nykthos-shrine-to-nyx': nykthosShrineToNyx,
  'ob-nixilis-the-fallen': obNixilisTheFallen,
  'scute-swarm': scuteSwarm,
  'tendrils-of-agony': tendrilsOfAgony,
}

export function computeFor(cardId: string): ComputeFn {
  const compute = COMPUTE_BY_CARD_ID[cardId]
  if (!compute) throw new Error(`No client-side compute registered for card ${cardId}`)
  return compute
}
