import type { ChangeEvent, ReactNode } from 'react'
import { Text } from './Text'

interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  label: string
  /** Hides the label visually while keeping it for screen readers -- for fields whose
   * purpose is obvious in context (a search box next to a magnifier, a row of names). */
  hideLabel?: boolean
  placeholder?: string
  type?: 'text' | 'search'
  /** Rendered inside the field, before the input -- e.g. a SearchIcon. */
  leading?: ReactNode
  className?: string
}

/**
 * Single-line text input. The only text-entry primitive: everything that needs typed
 * text (entrant names, search) goes through here rather than hand-rolling a bordered
 * <input>. Ports to RN as a `TextInput` with the same props.
 *
 * The <label> wraps the input rather than pointing at it by id, so the association
 * needs no generated id and tapping the label text focuses the field.
 */
export function TextField({
  value,
  onChange,
  label,
  hideLabel = false,
  placeholder,
  type = 'text',
  leading,
  className = '',
}: TextFieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {!hideLabel && (
        <Text variant="label" color="muted">
          {label}
        </Text>
      )}
      <div className="flex min-h-12 items-center gap-2 rounded-pill border border-border bg-surface px-4">
        {leading}
        <input
          type={type}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={hideLabel ? label : undefined}
          className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-text-muted"
        />
      </div>
    </label>
  )
}
