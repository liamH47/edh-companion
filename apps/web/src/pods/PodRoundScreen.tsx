import { entrantName } from '@mtg/core/swiss'
import type { PodRound, PodSession } from '@mtg/core/pods'
import { Button } from '../ui/Button'
import { EntrantBadge } from '../ui/EntrantBadge'
import { ShuffleIcon } from '../ui/Icon'
import { Text } from '../ui/Text'

interface PodRoundScreenProps {
  session: PodSession
  round: PodRound
  /** Only the latest round can be reshuffled or followed by a new one; earlier rounds
   * are history and show read-only. */
  isLatest: boolean
  onNextRound: () => void
  onReshuffle: () => void
}

/**
 * One round's tables. No results to report -- a pod here is just who is sitting
 * together -- so unlike the Swiss round screen a pod is plain text, not a button.
 */
export function PodRoundScreen({
  session,
  round,
  isLatest,
  onNextRound,
  onReshuffle,
}: PodRoundScreenProps) {
  const nameById = new Map(session.players.map((player) => [player.id, player.name]))
  // `entrantName` is the one place a display name is formed, so a missing id degrades the
  // same way everywhere rather than throwing.
  const nameOf = (id: string) => entrantName({ id, members: [nameById.get(id) ?? id], seat: 0, droppedAfterRound: null })

  return (
    <section className="flex flex-col gap-4">
      <Text as="h2" variant="title">
        Round {round.number}
      </Text>

      {round.hadToRepeatTable && (
        <div role="alert" className="rounded-lg border border-border bg-surface-raised px-4 py-3">
          <Text variant="body" color="muted">
            Everyone has played most of the group, so this round repeats some tablemates.
          </Text>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {round.pods.map((pod, index) => (
          <li
            key={pod.seats.join('-')}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <EntrantBadge />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Text variant="label" color="muted">
                Pod {index + 1} · {pod.seats.length} players
              </Text>
              <Text variant="bodyStrong">{pod.seats.map(nameOf).join(', ')}</Text>
            </span>
          </li>
        ))}
      </ul>

      {isLatest && (
        <div className="flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Button size="lg" fullWidth onClick={onNextRound}>
            New round
          </Button>
          <Button variant="secondary" fullWidth onClick={onReshuffle}>
            <span className="flex items-center justify-center gap-2">
              <ShuffleIcon />
              Reshuffle this round
            </span>
          </Button>
        </div>
      )}
    </section>
  )
}
