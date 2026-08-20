import { formatNumber } from '@mtg/core'
import type { OutputSpec, OutputValues } from '@mtg/core'
import { StatTile } from '../ui/StatTile'

interface StatStripProps {
  outputs: OutputSpec[]
  values: OutputValues | null
  pending: boolean
  /** Quieter tiles for screens where the card art is the main event (show_hero_art):
   * the strip reads as annotation under the card rather than a peer panel to it. */
  compact?: boolean
}

/** Horizontally-wrapping row of every non-hero output, centred so it shares the
 * hero's axis -- two tiles hugging the left edge under a dead-centred hero number is
 * what made the Dungeons screen read as disjointed. Renders nothing for a card with
 * zero non-primary outputs (screen-spec.md rule 6) -- an empty strip is worse than
 * no strip. */
export function StatStrip({ outputs, values, pending, compact = false }: StatStripProps) {
  if (outputs.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {outputs.map((output) => {
        const raw = values?.[output.name]
        const value = typeof raw === 'number' ? formatNumber(raw) : String(raw ?? '—')
        return (
          <StatTile
            key={output.name}
            label={output.short_label ?? output.label}
            value={value}
            pending={pending}
            compact={compact}
          />
        )
      })}
    </div>
  )
}
