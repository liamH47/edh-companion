import { useState } from 'react'
import { isSoundEnabled, setSoundEnabled } from '@mtg/core'
import { SpeakerIcon, SpeakerOffIcon } from './ui/Icon'

/**
 * The single, global sound switch. It gates every sound the app plays -- card win/lose,
 * the coin flip, the dice roll -- so it lives once in the header next to the theme
 * toggle, not inside any one screen, and its label says "sound", not "coin flip sound".
 */
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
      aria-label={enabled ? 'Mute sound' : 'Unmute sound'}
      className="min-h-12 min-w-12 rounded-full border border-border text-text-muted hover:bg-surface-raised hover:text-text"
    >
      {enabled ? (
        <SpeakerIcon className="mx-auto h-5 w-5" />
      ) : (
        <SpeakerOffIcon className="mx-auto h-5 w-5" />
      )}
    </button>
  )
}
