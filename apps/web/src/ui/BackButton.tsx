import { ChevronLeftIcon } from './Icon'
import { Pressable } from './Pressable'
import { Text } from './Text'

interface BackButtonProps {
  onClick: () => void
  /** Bare icon circle when omitted -- the shape a screen header needs, flanked
   * symmetrically by another icon button (CardScreen's back + "View card" pair).
   * With a label, renders icon-plus-text inline instead: the shape a toolbar row
   * needs sitting beside other pills (PodsScreen/SwissScreen's round-number row),
   * where a bare circle would read as one more round pill rather than a way out. */
  label?: string
  /** Layout only (e.g. `self-start` when the caller's own container is a flex column,
   * which would otherwise stretch the button to full width) -- never a color/type
   * override, same convention as Button/Pressable's className. */
  className?: string
}

/**
 * The one "go back" control. Extracted from three places that each hand-rolled their
 * own version -- CardScreen's icon circle, and PodsScreen/SwissScreen/PodSetupScreen's
 * literal `‹ Pairings` text button. The chevron is the app's own hand-drawn icon
 * (aria-hidden) rather than a typed `‹` character baked into the accessible name, which
 * used to make the label-form buttons announce as "less-than sign, Pairings" instead of
 * plain "Pairings".
 */
export function BackButton({ onClick, label, className = '' }: BackButtonProps) {
  if (label) {
    return (
      <Pressable
        onClick={onClick}
        className={`min-h-12 items-center gap-1 rounded-lg px-2 text-text-muted hover:text-text ${className}`}
      >
        <ChevronLeftIcon />
        <Text variant="bodyStrong">{label}</Text>
      </Pressable>
    )
  }
  return (
    <Pressable
      aria-label="Back"
      onClick={onClick}
      className={`min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text ${className}`}
    >
      <ChevronLeftIcon />
    </Pressable>
  )
}
