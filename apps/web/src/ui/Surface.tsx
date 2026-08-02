import type { ReactNode } from 'react'

export type SurfaceLevel = 'base' | 'raised'
export type SurfaceRadius = 'sm' | 'md' | 'lg'

const levelClasses: Record<SurfaceLevel, string> = {
  base: 'bg-surface border border-border',
  raised: 'bg-surface-raised border border-border',
}

const radiusClasses: Record<SurfaceRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
}

interface SurfaceProps {
  level?: SurfaceLevel
  radius?: SurfaceRadius
  padded?: boolean
  className?: string
  children?: ReactNode
}

/** Flat panel primitive: a bordered, tinted background at one of two elevation
 * levels. Ports to RN as a `View` with the same two style buckets. */
export function Surface({
  level = 'base',
  radius = 'md',
  padded = true,
  className = '',
  children,
}: SurfaceProps) {
  const classes = [levelClasses[level], radiusClasses[radius], padded ? 'p-4' : '', className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes}>{children}</div>
}
