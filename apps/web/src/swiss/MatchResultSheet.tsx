import type { Match, MatchFormat, MatchResult } from '@mtg/core/swiss'
import { Button } from '../ui/Button'
import { Pressable } from '../ui/Pressable'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'

interface MatchResultSheetProps {
  open: boolean
  onClose: () => void
  match: Match | null
  format: MatchFormat
  /** Display names, positionally aligned with the match's `entrantIds`. */
  names: string[]
  onReport: (result: MatchResult | null) => void
  /** Shown when this round already has later rounds paired from it, so the user can
   * choose between keeping those pairings and re-pairing from here. */
  onRepair?: () => void
}

interface ResultChoice {
  label: string
  result: MatchResult
}

/**
 * A pod is a single game with one survivor, so the question is "who won?" rather than
 * a scoreline -- listing every 4-player game-win permutation would be absurd. A draw
 * covers the pod that ran out of time, which does happen in Commander.
 */
function podChoicesFor(names: string[]): ResultChoice[] {
  const size = names.length
  return [
    ...names.map((name, index) => ({
      label: `${name} won`,
      result: {
        gameWins: Array.from({ length: size }, (_unused, i) => (i === index ? 1 : 0)),
        gameDraws: 0,
      },
    })),
    { label: 'Draw', result: { gameWins: Array.from({ length: size }, () => 0), gameDraws: 1 } },
  ]
}

/** Every scoreline a match of this length can end on, in the order a player thinks of
 * them: my wins first, then draws, then losses. */
function choicesFor(format: MatchFormat): ResultChoice[] {
  if (format === 'bo1') {
    return [
      { label: '1-0', result: { gameWins: [1, 0], gameDraws: 0 } },
      { label: 'Draw', result: { gameWins: [0, 0], gameDraws: 1 } },
      { label: '0-1', result: { gameWins: [0, 1], gameDraws: 0 } },
    ]
  }
  return [
    { label: '2-0', result: { gameWins: [2, 0], gameDraws: 0 } },
    { label: '2-1', result: { gameWins: [2, 1], gameDraws: 0 } },
    { label: '1-1 draw', result: { gameWins: [1, 1], gameDraws: 1 } },
    { label: '1-2', result: { gameWins: [1, 2], gameDraws: 0 } },
    { label: '0-2', result: { gameWins: [0, 2], gameDraws: 0 } },
  ]
}

function sameResult(a: MatchResult | null, b: MatchResult): boolean {
  return (
    a !== null &&
    a.gameDraws === b.gameDraws &&
    a.gameWins.length === b.gameWins.length &&
    a.gameWins.every((wins, index) => wins === b.gameWins[index])
  )
}

/**
 * Reports or corrects one match. For a 1v1, scorelines are written from the first
 * entrant's side, which is why their name is shown first above them. For a pod, the
 * choices are "who won" plus a draw -- see podChoicesFor.
 */
export function MatchResultSheet({
  open,
  onClose,
  match,
  format,
  names,
  onReport,
  onRepair,
}: MatchResultSheetProps) {
  if (match === null) return null

  const isPod = match.entrantIds.length > 2
  const choices = isPod ? podChoicesFor(names) : choicesFor(format)

  return (
    <Sheet open={open} onClose={onClose} title="Report result">
      <div className="flex flex-col gap-4">
        <Text variant="bodyStrong">{names.join(' vs ')}</Text>

        <div className="flex flex-col gap-2">
          {choices.map((choice) => {
            const selected = sameResult(match.result, choice.result)
            return (
              <Pressable
                key={choice.label}
                aria-pressed={selected}
                onClick={() => {
                  onReport(choice.result)
                  onClose()
                }}
                className={`min-h-12 justify-center rounded-pill border text-body font-semibold ${
                  selected
                    ? 'border-accent bg-accent text-accent-text'
                    : 'border-border bg-surface text-text'
                }`}
              >
                {choice.label}
              </Pressable>
            )
          })}
        </div>

        {onRepair && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3">
            <Text variant="body" color="muted">
              Later rounds were already paired using this result. Standings update either
              way — re-pairing rebuilds those rounds from scratch.
            </Text>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                onRepair()
                onClose()
              }}
            >
              Re-pair later rounds
            </Button>
          </div>
        )}

        {match.result !== null && (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              onReport(null)
              onClose()
            }}
          >
            Clear result
          </Button>
        )}
      </div>
    </Sheet>
  )
}
