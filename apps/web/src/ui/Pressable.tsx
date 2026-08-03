import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from '@mtg/core/theme/tokens'

interface PressableProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  className?: string
  children?: ReactNode
}

/**
 * Minimal interactive wrapper for custom-shaped tap targets (a summary-bar row, a
 * stepper button, a chip) that shouldn't look like a `Button` but still need press
 * feedback. Callers own layout/sizing entirely via className.
 */
export function Pressable({
  type = 'button',
  className = '',
  style,
  children,
  ...rest
}: PressableProps) {
  const classes = [
    // Duration from the motion token, inline, rather than a hardcoded `duration-150`
    // that matched no token (portability-rules.md) -- the same fix as Button.
    'flex items-center text-left transition-transform active:scale-[0.98]',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
    'disabled:cursor-not-allowed disabled:opacity-60',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={classes}
      style={{ transitionDuration: `${motion.duration.fast}ms`, ...style }}
      {...rest}
    >
      {children}
    </button>
  )
}
