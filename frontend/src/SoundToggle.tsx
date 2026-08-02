import { useState } from 'react'
import { isSoundEnabled, setSoundEnabled } from './sound'

export function SoundToggle() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled())

  const toggle = () => {
    const next = !enabled
    setSoundEnabled(next)
    setEnabled(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Mute coin flip sound' : 'Unmute coin flip sound'}
      className="min-h-12 min-w-12 rounded-full border border-border text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
    >
      {enabled ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="mx-auto h-5 w-5"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M4 9v6h4l5 5V4L8 9H4z" />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            d="M16.5 8.5a5 5 0 0 1 0 7"
          />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            d="M18.7 6.3a8 8 0 0 1 0 11.4"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="mx-auto h-5 w-5"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M4 9v6h4l5 5V4L8 9H4z" />
          <path
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M16 9l5 5M21 9l-5 5"
          />
        </svg>
      )}
    </button>
  )
}
