import type { ReactNode } from 'react'

export type SurfaceLevel = 'base' | 'raised'
export type SurfaceRadius = 'sm' | 'md' | 'lg'
export type SurfaceTone = 'default' | 'danger'

const levelClasses: Record<SurfaceLevel, string> = {
  base: 'bg-surface border border-border',
  raised: 'bg-surface-raised border border-border',
}

/** A tone that isn't `default` sets its own background and border, so it replaces the
 * elevation-level classes rather than layering on top of them. */
const toneClasses: Record<Exclude<SurfaceTone, 'default'>, string> = {
  danger: 'bg-danger-surface border border-danger-border',
}

const radiusClasses: Record<SurfaceRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
}

interface SurfaceProps {
  level?: SurfaceLevel
  radius?: SurfaceRadius
  /** `danger` gives the panel the danger background/border -- the shape every alert
   * banner needs, so they compose this rather than hand-rolling a raw div. */
  tone?: SurfaceTone
  padded?: boolean
  /** ARIA role, e.g. `alert` for a danger banner. Maps to `accessibilityRole` in RN. */
  role?: string
  className?: string
  children?: ReactNode
}

/** Flat panel primitive: a bordered, tinted background at one of two elevation
 * levels, or a danger tone. Ports to RN as a `View` with the same style buckets. */
export function Surface({
  level = 'base',
  radius = 'md',
  tone = 'default',
  padded = true,
  role,
  className = '',
  children,
}: SurfaceProps) {
  const background = tone === 'default' ? levelClasses[level] : toneClasses[tone]
  const classes = [background, radiusClasses[radius], padded ? 'p-4' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div role={role} className={classes}>
      {children}
    </div>
  )
}
