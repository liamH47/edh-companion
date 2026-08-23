import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

export type TextVariant =
  | 'label'
  | 'body'
  | 'bodyStrong'
  | 'title'
  | 'statTile'
  | 'heroSm'
  | 'heroMd'
  | 'heroLg'

export type TextColor = 'default' | 'muted' | 'accent' | 'danger'

const variantClasses: Record<TextVariant, string> = {
  label: 'text-label font-semibold tracking-[0.06em] uppercase',
  body: 'text-body font-medium',
  bodyStrong: 'text-body-strong font-semibold',
  // The one place the display serif appears -- screen and sheet headers read as "a
  // ledger," not a dashboard. Every other variant stays on the body face set on <body>.
  title: 'text-title font-semibold font-display',
  statTile: 'text-stat-tile font-bold',
  heroSm: 'text-hero-sm font-bold',
  heroMd: 'text-hero-md font-bold',
  heroLg: 'text-hero-lg font-bold',
}

const colorClasses: Record<TextColor, string> = {
  default: 'text-text',
  muted: 'text-text-muted',
  accent: 'text-accent',
  danger: 'text-danger',
}

interface TextOwnProps {
  variant?: TextVariant
  color?: TextColor
  as?: ElementType
  className?: string
  children?: ReactNode
}

type TextProps = TextOwnProps & Omit<ComponentPropsWithoutRef<'span'>, keyof TextOwnProps>

/**
 * Typography primitive: one of the design system's fixed size/weight steps (see
 * theme/tokens.ts typeScale), applied via generated token utilities so a size only
 * ever changes in one place. Always tabular-nums, since every variant can end up
 * displaying a value that changes on recalculation. Forwards unknown props (id,
 * aria-*, ...) so callers can e.g. wire `aria-labelledby` at a dialog title.
 */
export function Text({
  variant = 'body',
  color = 'default',
  as: Component = 'span',
  className = '',
  children,
  ...rest
}: TextProps) {
  const classes = [variantClasses[variant], colorClasses[color], 'tabular-nums', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  )
}
