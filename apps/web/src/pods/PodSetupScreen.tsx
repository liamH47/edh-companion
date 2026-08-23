import { useState } from 'react'
import { MIN_PLAYERS } from '@mtg/core/pods'
import { podSizes } from '@mtg/core/swiss'
import { BackButton } from '../ui/BackButton'
import { Button } from '../ui/Button'
import { PlusIcon, TrashIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'

interface PodSetupScreenProps {
  onStart: (names: string[]) => void
  onBack: () => void
}

interface DraftPlayer {
  /** Stable across removals so React keys don't remount a field mid-typing. */
  key: number
  name: string
}

function blankPlayer(key: number): DraftPlayer {
  return { key, name: '' }
}

/** Enough rows for the small end of a playgroup, without a wall of empty fields. */
const INITIAL_ROWS = 4

/** Long enough for any real name, short enough that one entry can't blow out a pod row. */
const NAME_MAX_LENGTH = 40

/** How this many players will split, in words -- shown live so the group can see the
 * tables before committing. `podSizes` is the same splitter the rounds use. */
function podShape(count: number): string {
  const sizes = podSizes(count)
  if (sizes.length === 1) return `one pod of ${sizes[0]}`
  return `${sizes.length} pods: ${sizes.join(' and ')}`
}

/**
 * The roster for a casual pod night: just names. No seat order (the first round is
 * shuffled anyway), no rounds count (you make as many as you play), no match length.
 * Everything the Swiss setup asks that a kitchen-table meetup doesn't care about is gone.
 */
export function PodSetupScreen({ onStart, onBack }: PodSetupScreenProps) {
  const [players, setPlayers] = useState<DraftPlayer[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_unused, index) => blankPlayer(index + 1)),
  )
  const [nextKey, setNextKey] = useState(INITIAL_ROWS + 1)

  const named = players.filter((player) => player.name.trim() !== '')
  const canStart = named.length >= MIN_PLAYERS

  const setName = (key: number, name: string) => {
    setPlayers((current) =>
      current.map((player) => (player.key === key ? { ...player, name } : player)),
    )
  }

  const addPlayer = () => {
    setPlayers((current) => [...current, blankPlayer(nextKey)])
    setNextKey((key) => key + 1)
  }

  const removePlayer = (key: number) => {
    setPlayers((current) => current.filter((player) => player.key !== key))
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton onClick={onBack} label="Pairings" className="self-start" />
        <Text as="h2" variant="title">
          Commander pods
        </Text>
        <Text variant="body" color="muted">
          Add everyone playing, then generate pods. Each new round reshuffles the tables so
          people meet opponents they haven&apos;t played yet.
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <Text variant="bodyStrong">Players</Text>
        <ul className="flex flex-col gap-2">
          {players.map((player, index) => (
            <li key={player.key} className="flex items-center gap-2">
              <Text variant="label" color="muted" className="w-6 text-right">
                {index + 1}
              </Text>
              <TextField
                value={player.name}
                onChange={(value) => setName(player.key, value)}
                label={`Player ${index + 1}`}
                hideLabel
                placeholder={`Player ${index + 1}`}
                maxLength={NAME_MAX_LENGTH}
                className="min-w-0 flex-1"
              />
              <Pressable
                aria-label={`Remove player ${index + 1}`}
                disabled={players.length <= MIN_PLAYERS}
                onClick={() => removePlayer(player.key)}
                className="min-h-12 min-w-12 shrink-0 justify-center rounded-full border border-border text-danger disabled:text-disabled-text"
              >
                <TrashIcon />
              </Pressable>
            </li>
          ))}
        </ul>

        <Button variant="secondary" fullWidth onClick={addPlayer}>
          <span className="flex items-center justify-center gap-2">
            <PlusIcon />
            Add player
          </span>
        </Button>
      </div>

      <div className="flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Text variant="body" color="muted">
          {canStart
            ? `${named.length} players — ${podShape(named.length)}.`
            : `Add at least ${MIN_PLAYERS} players to make pods.`}
        </Text>
        <Button
          size="lg"
          fullWidth
          disabled={!canStart}
          onClick={() => onStart(named.map((player) => player.name.trim()))}
        >
          Generate pods
        </Button>
      </div>
    </section>
  )
}
