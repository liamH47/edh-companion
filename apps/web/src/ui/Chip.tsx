import type { ReactNode } from 'react'
import { Pressable } from './Pressable'

interface ChipProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

const baseClasses =
  'inline-flex items-center gap-1 rounded-pill bg-surface-raised px-3 py-1 text-body text-text whitespace-nowrap'

/** Small pill for compact facts (a setup-summary segment, a category tag). Renders
 * as a plain span unless `onClick` is given, in which case it becomes a tap target. */
export function Chip({ children, onClick, className = '' }: ChipProps) {
  const classes = [baseClasses, className].filter(Boolean).join(' ')
  if (onClick) {
    return (
      <Pressable onClick={onClick} className={`${classes} min-h-12`}>
        {children}
      </Pressable>
    )
  }
  return <span className={classes}>{children}</span>
}
