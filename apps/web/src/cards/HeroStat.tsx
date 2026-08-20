import { formatNumber, heroFontSize, type HeroFontSize } from '@mtg/core'
import { Text, type TextVariant } from '../ui/Text'

interface HeroStatProps {
  label: string
  value: number
  pending: boolean
  /** A tile-sized rendering for screens whose main event is an interactive field (a
   * dungeon map): still visually primary -- accent value, raised surface -- but no
   * longer a full-height centred column pushing the act content below the fold. */
  compact?: boolean
}

const heroVariantByFontSize: Record<HeroFontSize, TextVariant> = {
  lg: 'heroLg',
  md: 'heroMd',
  sm: 'heroSm',
}

/** The card's headline number (screen-spec.md rule 6). Font size steps down as the
 * value gains digits (rule 8), so a 6-digit Scute Swarm total doesn't overflow the
 * space a 2-digit Aetherflux total fits easily. Dims, but never blanks, while a
 * recalculation is in flight. */
export function HeroStat({ label, value, pending, compact = false }: HeroStatProps) {
  if (compact) {
    return (
      <div
        className={`flex flex-col items-center rounded-md bg-surface-raised px-3 py-1 ${pending ? 'opacity-60' : ''}`}
        data-testid="hero-compact"
      >
        <Text as="div" variant="statTile" className="text-accent" aria-live="polite">
          {formatNumber(value)}
        </Text>
        <Text as="div" variant="label" color="muted">
          {label}
        </Text>
      </div>
    )
  }
  return (
    <div className={`flex flex-col items-center gap-1 ${pending ? 'opacity-60' : ''}`}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <Text
        as="div"
        variant={heroVariantByFontSize[heroFontSize(value)]}
        aria-live="polite"
      >
        {formatNumber(value)}
      </Text>
    </div>
  )
}
