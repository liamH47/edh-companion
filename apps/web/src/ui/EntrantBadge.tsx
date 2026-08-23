import { UsersIcon } from './Icon'

interface EntrantBadgeProps {
  /** A single entrant's name -- renders their initial. Omit for a multi-entrant row (a
   * casual pod, or a podded Swiss table): no one name is "the" one to initial when
   * everyone in the row is listed at equal weight, so a group glyph stands in instead. */
  name?: string
}

const BASE =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent'

/**
 * The same "something to look at, not just read" anchor `CardThumb` gives a card row,
 * at the same generic cost -- there's no card behind a Swiss match or a pod table, so
 * this is an initial letter or a group glyph instead of art. Decorative: every caller
 * already renders the name(s) right beside it.
 */
export function EntrantBadge({ name }: EntrantBadgeProps) {
  if (name === undefined) {
    return (
      <span aria-hidden="true" className={BASE}>
        <UsersIcon size={16} />
      </span>
    )
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span aria-hidden="true" className={`${BASE} text-body-strong font-semibold`}>
      {initial}
    </span>
  )
}
