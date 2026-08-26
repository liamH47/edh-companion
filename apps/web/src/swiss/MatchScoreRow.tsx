import {
  drawCap,
  drawCount,
  winCap,
  winCounts,
  withDrawDelta,
  withPodDraw,
  withPodWinner,
  withWinDelta,
} from '@mtg/core/swiss'
import type { Match, MatchFormat, MatchResult } from '@mtg/core/swiss'
import { tapHaptic } from '@mtg/core'
import { EntrantBadge } from '../ui/EntrantBadge'
import { UndoIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'

interface MatchScoreRowProps {
  /** Never a bye -- RoundScreen renders those as a static row with no controls. */
  match: Match
  format: MatchFormat
  /** Commander events use set-winner semantics at every table size, including a
   * 2-player duel -- keyed off the event, never off `entrantIds.length`, which is what
   * keeps a `[1, 1]` shape unreachable there. */
  isPodEvent: boolean
  /** Display names, positionally aligned with `match.entrantIds`. */
  names: string[]
  onReport: (result: MatchResult | null) => void
}

/** The 1v1 scoreline, or the pod's outcome, as one short readable string. */
function statusText(
  match: Match,
  isPodEvent: boolean,
  names: string[],
): { text: string; reported: boolean } {
  if (match.result === null) return { text: 'Not reported', reported: false }
  const { gameWins, gameDraws } = match.result
  if (isPodEvent) {
    const winnerIndex = gameDraws > 0 ? -1 : gameWins.findIndex((wins) => wins > 0)
    return { text: winnerIndex === -1 ? 'Draw' : `${names[winnerIndex]} won`, reported: true }
  }
  const best = Math.max(...gameWins)
  const isDraw = gameWins.filter((wins) => wins === best).length > 1
  return { text: isDraw ? 'Draw' : gameWins.join('-'), reported: true }
}

/**
 * One match's inline score card: tap a name to report, no sheet in between.
 *
 * Two interaction shapes behind one layout. A 1v1 counts game wins -- tap a name for
 * +1 (capped at the format's winning threshold), the undo beside it for -1, and a Draw
 * line for the shared drawn-game count. A commander pod is a single game with one
 * survivor, so tapping a name SETS the winner outright and Draw covers the timed-out
 * table. Decrementing everything back to zero reports `null` -- "Not reported" is
 * reachable again by plain undoing, which is why there is no separate Clear control.
 *
 * The first tap reports the match: `isRoundComplete` is just `every(result !== null)`,
 * so a 1-0 in bo3 already scores as a win and lets "Start round N+1" appear. That is
 * fine -- the TO controls when to actually advance, and the scoreline on the row shows
 * exactly what has been entered so far.
 *
 * Accessible names are stable ("Add a game win for Ava") while the live count lives in
 * the button's visible content -- without the override, every tap would rename the
 * button under both screen readers and role-based queries.
 */
export function MatchScoreRow({ match, format, isPodEvent, names, onReport }: MatchScoreRowProps) {
  const wins = winCounts(match)
  const draws = drawCount(match)
  const isDraw = match.result !== null && draws > 0
  const winnerIndex =
    isPodEvent && match.result !== null && !isDraw ? wins.findIndex((count) => count > 0) : -1
  const status = statusText(match, isPodEvent, names)

  const report = (result: MatchResult | null) => {
    tapHaptic()
    onReport(result)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-2">
      {names.map((name, index) => {
        const addLabel = isPodEvent ? `${name} won` : `Add a game win for ${name}`
        const removeLabel = isPodEvent
          ? `Remove the win for ${name}`
          : `Remove a game win for ${name}`
        const atCap = isPodEvent ? winnerIndex === index : wins[index] >= winCap(format)
        const removeDisabled = isPodEvent ? winnerIndex !== index : wins[index] <= 0
        return (
          <div key={match.entrantIds[index]} className="flex items-center gap-1">
            <Pressable
              aria-label={addLabel}
              aria-pressed={isPodEvent ? winnerIndex === index : undefined}
              disabled={atCap}
              onClick={() =>
                report(
                  isPodEvent ? withPodWinner(match, index) : withWinDelta(match, index, 1, format),
                )
              }
              // disabled:opacity-100: at-cap is "finished", not "unavailable" -- dimming
              // the winner's own row would read as something being wrong with it.
              className="min-h-12 min-w-0 flex-1 gap-3 rounded-md px-2 hover:bg-surface-raised disabled:opacity-100"
            >
              <EntrantBadge name={name} />
              <Text variant="bodyStrong" className="min-w-0 flex-1 truncate">
                {name}
              </Text>
              <Text
                variant="statTile"
                color={(isPodEvent ? winnerIndex === index : wins[index] > 0) ? 'accent' : 'muted'}
                className="shrink-0"
              >
                {isPodEvent ? (winnerIndex === index ? 'Won' : '—') : wins[index]}
              </Text>
            </Pressable>
            <Pressable
              aria-label={removeLabel}
              disabled={removeDisabled}
              onClick={() =>
                report(isPodEvent ? null : withWinDelta(match, index, -1, format))
              }
              className="min-h-12 min-w-12 shrink-0 justify-center rounded-md text-text-muted hover:text-text disabled:text-disabled-text"
            >
              <UndoIcon size={16} />
            </Pressable>
          </div>
        )
      })}

      <div className="flex items-center gap-1">
        <Pressable
          aria-label={
            isPodEvent
              ? `Draw for the pod with ${names.join(', ')}`
              : `Add a game draw for ${names.join(' versus ')}`
          }
          aria-pressed={isPodEvent ? isDraw : undefined}
          disabled={isPodEvent ? isDraw : draws >= drawCap(format)}
          onClick={() => report(isPodEvent ? withPodDraw(match) : withDrawDelta(match, 1, format))}
          className="min-h-12 min-w-0 flex-1 gap-3 rounded-md px-2 hover:bg-surface-raised disabled:opacity-100"
        >
          <Text variant="body" color="muted" className="min-w-0 flex-1 truncate">
            Draw
          </Text>
          <Text
            variant="statTile"
            color={(isPodEvent ? isDraw : draws > 0) ? 'accent' : 'muted'}
            className="shrink-0"
          >
            {isPodEvent ? (isDraw ? 'Drawn' : '—') : draws}
          </Text>
        </Pressable>
        <Pressable
          aria-label={
            isPodEvent
              ? `Remove the draw for the pod with ${names.join(', ')}`
              : `Remove a game draw for ${names.join(' versus ')}`
          }
          disabled={isPodEvent ? !isDraw : draws <= 0}
          onClick={() => report(isPodEvent ? null : withDrawDelta(match, -1, format))}
          className="min-h-12 min-w-12 shrink-0 justify-center rounded-md text-text-muted hover:text-text disabled:text-disabled-text"
        >
          <UndoIcon size={16} />
        </Pressable>
      </div>

      <div aria-live="polite" className="px-2 pb-1 text-right">
        <Text variant="label" color={status.reported ? 'accent' : 'muted'}>
          {status.text}
        </Text>
      </div>
    </div>
  )
}
