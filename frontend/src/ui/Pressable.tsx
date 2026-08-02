import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
  children,
  ...rest
}: PressableProps) {
  const classes = [
    'flex items-center text-left transition-transform duration-150 active:scale-[0.98]',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
    'disabled:cursor-not-allowed disabled:opacity-60',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
