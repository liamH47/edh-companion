import type { EffectLine } from '../types'

/**
 * Effect-line assembly, shared by the roster cards. Mirrors
 * backend/app/cards/effects.py.
 *
 * Landfall and Storm ask the same question in the same shape: several sources, one
 * repeated event, and a readout saying what each source produced. Only which sources
 * exist and how the event count is derived differ per card.
 */

/** One permanent or spell in a roster. Mirrors `Source`, minus the Scryfall id -- that
 * is presentation and rides in the field's options, never through compute(). */
export interface Source {
  label: string
  effect: string
  totals?: readonly (readonly [string, number])[]
  /** Fires once per copy when the per-ability count reaches the threshold, never again. */
  rider?: string
  riderTotals?: readonly (readonly [string, number])[]
}

/** Mirrors `TOTAL_TEMPLATES`, including the order notes read in. */
export const TOTAL_TEMPLATES: Record<string, string> = {
  mana: '{n} mana',
  cards: '{n} card{s}',
  life: '{n} life',
  damage_each: '{n} damage to each opponent',
  damage_one: '{n} damage',
  life_loss: '{n} life lost',
  tokens: '{n} token{s}',
  counters: '{n} counter{s}',
  mill_self: '{n} milled',
  mill_one: '{n} milled by a player',
  mill_each: '{n} milled by each opponent',
}

export function phrase(category: string, amount: number): string {
  return TOTAL_TEMPLATES[category]
    .replace('{n}', String(amount))
    .replace('{s}', amount === 1 ? '' : 's')
}

function note(
  totals: Record<string, number>,
  resolutions: number,
  riderFired: string | null,
): string {
  const parts = Object.keys(TOTAL_TEMPLATES)
    .filter((category) => (totals[category] ?? 0) !== 0)
    .map((category) => phrase(category, totals[category]))
  if (parts.length === 0) parts.push(`x${resolutions}`)
  if (riderFired !== null) parts.push(riderFired)
  return parts.join(' · ')
}

interface BuildOptions {
  riderThreshold?: number
  forecastNote?: string
}

/** One effect line per distinct source, plus the totals rolled up across all of them.
 * Mirrors `build_lines`. */
export function buildLines(
  sources: Record<string, Source>,
  picked: readonly string[],
  perAbility: number,
  { riderThreshold, forecastNote }: BuildOptions = {},
): { lines: EffectLine[]; aggregate: Record<string, number> } {
  const copies = new Map<string, number>()
  for (const sourceId of picked) copies.set(sourceId, (copies.get(sourceId) ?? 0) + 1)

  const lines: EffectLine[] = []
  const aggregate: Record<string, number> = {}

  for (const [sourceId, count] of copies) {
    const source = sources[sourceId]
    const resolutions = perAbility * count

    const totals: Record<string, number> = {}
    for (const [category, amount] of source.totals ?? []) {
      totals[category] = amount * resolutions
    }
    const riderFired =
      riderThreshold !== undefined && perAbility >= riderThreshold ? (source.rider ?? null) : null
    if (riderFired !== null) {
      for (const [category, amount] of source.riderTotals ?? []) {
        totals[category] = (totals[category] ?? 0) + amount * count
      }
    }

    for (const [category, amount] of Object.entries(totals)) {
      aggregate[category] = (aggregate[category] ?? 0) + amount
    }

    lines.push({
      source: count === 1 ? source.label : `${source.label} x${count}`,
      effect: source.effect,
      note:
        resolutions === 0 && forecastNote !== undefined
          ? forecastNote
          : note(totals, resolutions, riderFired),
    })
  }

  return { lines, aggregate }
}
