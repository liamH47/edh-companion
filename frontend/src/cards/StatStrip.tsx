import { formatNumber } from '../core/cardModel'
import type { OutputSpec, OutputValues } from '../types'
import { StatTile } from '../ui/StatTile'

interface StatStripProps {
  outputs: OutputSpec[]
  values: OutputValues | null
  pending: boolean
}

/** Horizontally-wrapping row of every non-hero output. Renders nothing for a card
 * with zero non-primary outputs (screen-spec.md rule 6) -- an empty strip is worse
 * than no strip. */
export function StatStrip({ outputs, values, pending }: StatStripProps) {
  if (outputs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {outputs.map((output) => {
        const raw = values?.[output.name]
        const value = typeof raw === 'number' ? formatNumber(raw) : String(raw ?? '—')
        return (
          <StatTile
            key={output.name}
            label={output.short_label ?? output.label}
            value={value}
            pending={pending}
          />
        )
      })}
    </div>
  )
}
