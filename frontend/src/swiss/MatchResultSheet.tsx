import type { Match, MatchFormat, MatchResult } from '../core/swiss/types'
import { Button } from '../ui/Button'
import { Pressable } from '../ui/Pressable'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'

interface MatchResultSheetProps {
  open: boolean
  onClose: () => void
  match: Match | null
  format: MatchFormat
  aName: string
  bName: string
  onReport: (result: MatchResult | null) => void
  /** Shown when this round already has later rounds paired from it, so the user can
   * choose between keeping those pairings and re-pairing from here. */
  onRepair?: () => void
}

interface ResultChoice {
  label: string
  result: MatchResult
}

/** Every scoreline a match of this length can end on, in the order a player thinks of
 * them: my wins first, then draws, then losses. */
function choicesFor(format: MatchFormat): ResultChoice[] {
  if (format === 'bo1') {
    return [
      { label: '1-0', result: { aGameWins: 1, bGameWins: 0, gameDraws: 0 } },
      { label: 'Draw', result: { aGameWins: 0, bGameWins: 0, gameDraws: 1 } },
      { label: '0-1', result: { aGameWins: 0, bGameWins: 1, gameDraws: 0 } },
    ]
  }
  return [
    { label: '2-0', result: { aGameWins: 2, bGameWins: 0, gameDraws: 0 } },
    { label: '2-1', result: { aGameWins: 2, bGameWins: 1, gameDraws: 0 } },
    { label: '1-1 draw', result: { aGameWins: 1, bGameWins: 1, gameDraws: 1 } },
    { label: '1-2', result: { aGameWins: 1, bGameWins: 2, gameDraws: 0 } },
    { label: '0-2', result: { aGameWins: 0, bGameWins: 2, gameDraws: 0 } },
  ]
}

function sameResult(a: MatchResult | null, b: MatchResult): boolean {
  return (
    a !== null &&
    a.aGameWins === b.aGameWins &&
    a.bGameWins === b.bGameWins &&
    a.gameDraws === b.gameDraws
  )
}

/** Reports or corrects one match. Scorelines are written from entrant A's side, which
 * is why A's name is always shown first above them. */
export function MatchResultSheet({
  open,
  onClose,
  match,
  format,
  aName,
  bName,
  onReport,
  onRepair,
}: MatchResultSheetProps) {
  if (match === null) return null

  return (
    <Sheet open={open} onClose={onClose} title="Report result">
      <div className="flex flex-col gap-4">
        <Text variant="bodyStrong">
          {aName} vs {bName}
        </Text>

        <div className="flex flex-col gap-2">
          {choicesFor(format).map((choice) => {
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
