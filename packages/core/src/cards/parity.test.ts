import { describe, expect, it } from 'vitest'
import metadata from './metadata.generated.json'
import { COMPUTE_BY_CARD_ID, computeFor } from './registry'
import { InputError, validateInputs } from './validation'
import type { CardMetadata, FieldValues, OutputValues } from '../types'

import aetherfluxReservoir from './__parity__/aetherflux-reservoir.json'
import brainFreeze from './__parity__/brain-freeze.json'
import cometStellarPup from './__parity__/comet-stellar-pup.json'
import commanderTax from './__parity__/commander-tax.json'
import craterhoofBehemoth from './__parity__/craterhoof-behemoth.json'
import dungeons from './__parity__/dungeons.json'
import emptyTheWarrens from './__parity__/empty-the-warrens.json'
import grapeshot from './__parity__/grapeshot.json'
import kalonianHydra from './__parity__/kalonian-hydra.json'
import landfall from './__parity__/landfall.json'
import manaPool from './__parity__/mana-pool.json'
import nykthosShrineToNyx from './__parity__/nykthos-shrine-to-nyx.json'
import obNixilisTheFallen from './__parity__/ob-nixilis-the-fallen.json'
import scuteSwarm from './__parity__/scute-swarm.json'
import storm from './__parity__/storm.json'
import tendrilsOfAgony from './__parity__/tendrils-of-agony.json'

/**
 * Proves the TypeScript card implementations agree with Python's, which remains the
 * source of truth.
 *
 * Every case here was produced by running the *Python* card
 * (`backend/tools/generate_parity_corpus.py`). Nothing in this file decides what the
 * right answer is; it only checks that TypeScript reaches the same one.
 *
 * Three gates keep the two from drifting:
 *   1. `generate_parity_corpus.py --check` in CI fails if the corpus is stale, which
 *      catches "someone changed a Python formula" and "someone added a card".
 *   2. This file replays every case, which catches TypeScript drift.
 *   3. The registry-completeness test below, which is what turns adding a Python card
 *      into a red suite until the TypeScript side exists.
 */

interface ParityCase {
  inputs: FieldValues
  outputs?: OutputValues
  error?: { field: string; code: string }
}

interface Corpus {
  cardId: string
  cases: ParityCase[]
}

const CORPORA: Corpus[] = [
  aetherfluxReservoir,
  brainFreeze,
  cometStellarPup,
  commanderTax,
  craterhoofBehemoth,
  dungeons,
  emptyTheWarrens,
  grapeshot,
  kalonianHydra,
  landfall,
  manaPool,
  nykthosShrineToNyx,
  obNixilisTheFallen,
  scuteSwarm,
  storm,
  tendrilsOfAgony,
] as Corpus[]

/** Key order differs between a Python dict and a TypeScript object literal, and that
 * difference is not a behaviour difference. Sort before comparing so a failure means
 * the numbers disagree.
 *
 * Recursive, because a `lines` output (landfall's effect rows) nests objects inside an
 * array: sorting only the top level would compare `{source, effect, note}` against
 * Python's alphabetized `{effect, note, source}` and report every identical row as a
 * mismatch. Array *order* is left alone -- that one is real content. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortDeep(nested)]),
    )
  }
  return value
}

function canonical(values: OutputValues | undefined): string {
  if (values === undefined) return 'undefined'
  return JSON.stringify(sortDeep(values))
}

const CARDS = metadata as CardMetadata[]
const cardById = new Map(CARDS.map((card) => [card.id, card]))

describe('registry completeness', () => {
  it('implements exactly the cards the backend registers', () => {
    // The forcing function: add a card in Python, regenerate, and this goes red until
    // the TypeScript compute exists. Documentation would not have stopped the drift.
    expect(Object.keys(COMPUTE_BY_CARD_ID).sort()).toEqual(CARDS.map((c) => c.id).sort())
  })

  it('has a corpus for every card', () => {
    expect(CORPORA.map((c) => c.cardId).sort()).toEqual(CARDS.map((c) => c.id).sort())
  })

  it('has cases in every corpus', () => {
    for (const corpus of CORPORA) {
      expect(corpus.cases.length, corpus.cardId).toBeGreaterThan(0)
    }
  })

  it('returns exactly the outputs each card declares', () => {
    // A compute that quietly stops returning an output would otherwise only surface as
    // a blank tile in the UI.
    for (const card of CARDS) {
      const declared = card.outputs.map((output) => output.name)
      const alert = card.alert ? [card.alert.output] : []
      const defaults: FieldValues = {}
      for (const field of card.fields) defaults[field.name] = field.default

      const produced = Object.keys(computeFor(card.id)(validateInputs(card.fields, defaults)))
      expect(produced.sort(), card.id).toEqual([...declared, ...alert].sort())
    }
  })
})

describe.each(CORPORA.map((corpus) => [corpus.cardId, corpus] as const))(
  'parity: %s',
  (cardId, corpus) => {
    const card = cardById.get(cardId)!
    const compute = computeFor(cardId)

    it(`matches Python across all ${corpus.cases.length} recorded cases`, () => {
      const mismatches: string[] = []

      for (const [index, testCase] of corpus.cases.entries()) {
        const label = `case ${index} ${JSON.stringify(testCase.inputs)}`
        try {
          const validated = validateInputs(card.fields, testCase.inputs)
          const outputs = compute(validated)
          if (testCase.error) {
            mismatches.push(`${label}: expected ${testCase.error.code}, got outputs`)
          } else if (canonical(outputs) !== canonical(testCase.outputs)) {
            mismatches.push(
              `${label}\n  python: ${JSON.stringify(testCase.outputs)}\n      ts: ${JSON.stringify(outputs)}`,
            )
          }
        } catch (error) {
          if (!(error instanceof InputError)) throw error
          if (!testCase.error) {
            mismatches.push(`${label}: expected outputs, got ${error.code}`)
          } else if (error.code !== testCase.error.code || error.field !== testCase.error.field) {
            mismatches.push(
              `${label}: python ${testCase.error.field}/${testCase.error.code}, ts ${error.field}/${error.code}`,
            )
          }
        }
      }

      // All at once rather than the first: a formula change usually breaks many cases,
      // and the pattern is what tells you what went wrong.
      expect(mismatches.slice(0, 10).join('\n'), `${mismatches.length} mismatch(es)`).toBe('')
    })
  },
)

describe('the swarm bound that used to explode', () => {
  it('refuses the input that once produced a 50-character answer', () => {
    // Scute Swarm shipped allowing 999,999,999 copies and 99 land drops, which doubles
    // to about 6.3e50 -- arithmetically correct and completely unusable. The bounds now
    // refuse it, and both implementations refuse it the same way.
    const card = cardById.get('scute-swarm')!
    expect(() =>
      validateInputs(card.fields, {
        current_land_count: 6,
        scute_swarm_count: 999999999,
        insect_token_count: 0,
        lands_played: 99,
      }),
    ).toThrow(InputError)
  })

  it('keeps the answer readable at the declared maximum', () => {
    // The bound is a promise about what the screen has to survive, so check the promise
    // rather than trusting the number in the spec.
    const card = cardById.get('scute-swarm')!
    const maxInputs: FieldValues = {}
    for (const field of card.fields) maxInputs[field.name] = field.max ?? field.default

    const outputs = computeFor('scute-swarm')(validateInputs(card.fields, maxInputs))
    const biggest = Math.max(
      ...Object.values(outputs).filter((v): v is number => typeof v === 'number'),
    )

    expect(biggest).toBeLessThan(1_000_000)
    expect(biggest).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})
