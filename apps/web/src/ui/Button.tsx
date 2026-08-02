import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-text hover:opacity-90 disabled:bg-disabled-surface disabled:text-disabled-text disabled:opacity-100',
  secondary:
    'bg-transparent text-text border border-border hover:bg-surface-raised disabled:text-disabled-text disabled:border-disabled-surface',
  ghost: 'bg-transparent text-text-muted hover:text-text disabled:text-disabled-text',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-12 px-4 text-body font-semibold',
  lg: 'min-h-12 px-6 text-body-strong font-semibold',
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Pill action button. Always >=48px tall (hitTarget.min) regardless of size, since
 * size only varies horizontal padding/emphasis, not tap-target height. Defaults to
 * type="button" -- every form in this app is submit-less (see useCardSession).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'rounded-pill transition-transform duration-150 active:scale-[0.97]',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
    'disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
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
