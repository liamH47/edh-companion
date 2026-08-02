import { formatNumber, heroFontSize, type HeroFontSize } from '../core/cardModel'
import { Text, type TextVariant } from '../ui/Text'

interface HeroStatProps {
  label: string
  value: number
  pending: boolean
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
export function HeroStat({ label, value, pending }: HeroStatProps) {
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
