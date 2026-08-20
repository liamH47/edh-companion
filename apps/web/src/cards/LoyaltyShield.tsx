import { formatNumber } from '@mtg/core'
import { Text } from '../ui/Text'

interface LoyaltyBadgeProps {
  value: number
  /** Tints the badge with the danger tones -- the planeswalker is dead. The one path
   * design-tokens.md reserves danger for. */
  dead: boolean
}

/**
 * The badge alone: the planeswalker loyalty shape with the live number, no label. Used
 * at two sizes -- standalone inside `LoyaltyShield`, and scaled down by `CardArtHero`
 * over the printed loyalty box, where the frame's own box is the label.
 *
 * Hand-written SVG per portability-rules.md; the decorative shield metal uses raw hex
 * like CoinBase's gold, but the number renders through theme-stable colors.
 */
export function LoyaltyBadge({ value, dead }: LoyaltyBadgeProps) {
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-hidden="true">
        {/* The planeswalker badge: flat shoulders, sides tucking in, a point at the
            bottom. Two strokes give it the embossed double edge of the printed box. */}
        <path
          d="M14 14 H86 Q88 44 74 68 Q64 84 50 94 Q36 84 26 68 Q12 44 14 14 Z"
          fill={dead ? 'var(--color-danger-surface)' : '#4a4658'}
          stroke={dead ? 'var(--color-danger-border)' : '#2e2b38'}
          strokeWidth="3"
        />
        <path
          d="M20 20 H80 Q81 45 69 65 Q60 79 50 87 Q40 79 31 65 Q19 45 20 20 Z"
          fill="none"
          stroke={dead ? 'var(--color-danger-border)' : '#6b6580'}
          strokeWidth="1.5"
          opacity="0.7"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="40"
          fontWeight="bold"
          fill={dead ? 'var(--color-danger)' : '#ffffff'}
          aria-hidden="true"
        >
          {formatNumber(value)}
        </text>
      </svg>
      {/* The SVG numeral is decoration; this is the accessible, announced value. */}
      <span aria-live="polite" className="sr-only">
        {formatNumber(value)}
      </span>
    </div>
  )
}

interface LoyaltyShieldProps {
  label: string
  value: number
  pending: boolean
  dead: boolean
}

/**
 * The standalone shield hero: label over badge, the same data contract as HeroStat
 * (formatNumber, dimmed pending, polite live region) with a planeswalker skin. This is
 * what renders when the card image is unavailable -- the game state never waits on the
 * network.
 */
export function LoyaltyShield({ label, value, pending, dead }: LoyaltyShieldProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 ${pending ? 'opacity-60' : ''}`}
      data-testid="loyalty-shield"
    >
      <Text variant="label" color="muted">
        {label}
      </Text>
      <div className="h-24 w-24">
        <LoyaltyBadge value={value} dead={dead} />
      </div>
    </div>
  )
}
