import { useState } from 'react'
import {
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  recommendedRounds,
  type CreateTournamentInput,
} from '../core/swiss/tournament'
import { shuffle } from '../core/swiss/pairing'
import type { MatchFormat, Rng, TournamentMode } from '../core/swiss/types'
import { Button } from '../ui/Button'
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Stepper } from '../ui/Stepper'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'

interface TournamentSetupScreenProps {
  onStart: (input: CreateTournamentInput, seatingIsRandom: boolean) => void
  /** Injectable so a test can assert a specific seating rather than "some order". */
  rng?: Rng
}

const MIN_ENTRANTS = 2

interface DraftEntrant {
  /** Stable across reorders so React keys don't remount a field mid-typing. */
  key: number
  members: string[]
}

function blankEntrant(key: number, mode: TournamentMode): DraftEntrant {
  return { key, members: mode === 'two-headed-giant' ? ['', ''] : [''] }
}

const segmentClasses = 'min-h-12 flex-1 justify-center rounded-pill text-body font-semibold'

/**
 * Everything decided before the first pairing: mode, who's playing, what order they
 * drafted in, how many rounds, and best-of-how-many. Seating can be randomised, or
 * entered by hand with per-row move buttons -- the MTG Companion app only offers the
 * former, which is the gap this screen exists to close.
 */
export function TournamentSetupScreen({ onStart, rng = Math.random }: TournamentSetupScreenProps) {
  const [mode, setMode] = useState<TournamentMode>('solo')
  const [format, setFormat] = useState<MatchFormat>('bo3')
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS)
  const [entrants, setEntrants] = useState<DraftEntrant[]>([
    blankEntrant(1, 'solo'),
    blankEntrant(2, 'solo'),
    blankEntrant(3, 'solo'),
    blankEntrant(4, 'solo'),
  ])
  const [nextKey, setNextKey] = useState(5)

  const isTeams = mode === 'two-headed-giant'
  const entrantNoun = isTeams ? 'Team' : 'Player'
  const namedEntrants = entrants.filter((entrant) =>
    entrant.members.every((member) => member.trim() !== ''),
  )
  const canStart = namedEntrants.length >= MIN_ENTRANTS

  const changeMode = (next: TournamentMode) => {
    setMode(next)
    // Two-Headed Giant needs a second name per team, and is always best-of-one.
    setEntrants((current) =>
      current.map((entrant) => ({
        ...entrant,
        members:
          next === 'two-headed-giant'
            ? // members[1] is genuinely absent when coming from singles; members[0]
              // always exists, since every row is created with at least one slot.
              [entrant.members[0], entrant.members[1] ?? '']
            : [entrant.members[0]],
      })),
    )
    if (next === 'two-headed-giant') setFormat('bo1')
  }

  const setMember = (key: number, index: number, value: string) => {
    setEntrants((current) =>
      current.map((entrant) =>
        entrant.key === key
          ? { ...entrant, members: entrant.members.map((m, i) => (i === index ? value : m)) }
          : entrant,
      ),
    )
  }

  const addEntrant = () => {
    setEntrants((current) => [...current, blankEntrant(nextKey, mode)])
    setNextKey((key) => key + 1)
  }

  const removeEntrant = (key: number) => {
    setEntrants((current) => current.filter((entrant) => entrant.key !== key))
  }

  // No bounds guard: the up button is disabled on the first row and the down button
  // on the last, so `target` is always inside the array.
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    setEntrants((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // core/swiss/pairing's shuffle rather than a second hand-rolled Fisher-Yates, so
  // there is one shuffle in the codebase and it is the tested one.
  const shuffleSeats = () => {
    setEntrants((current) => shuffle(current, rng))
  }

  const submit = (seatingIsRandom: boolean) => {
    onStart(
      {
        mode,
        format,
        totalRounds: rounds,
        entrantMembers: namedEntrants.map((entrant) =>
          entrant.members.map((member) => member.trim()),
        ),
      },
      seatingIsRandom,
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Text as="h2" variant="title">
          New tournament
        </Text>
        <div role="group" aria-label="Format" className="flex gap-1 rounded-pill border border-border bg-surface p-1">
          <Pressable
            aria-pressed={!isTeams}
            onClick={() => changeMode('solo')}
            className={`${segmentClasses} ${!isTeams ? 'bg-accent text-accent-text' : 'text-text-muted'}`}
          >
            Singles
          </Pressable>
          <Pressable
            aria-pressed={isTeams}
            onClick={() => changeMode('two-headed-giant')}
            className={`${segmentClasses} ${isTeams ? 'bg-accent text-accent-text' : 'text-text-muted'}`}
          >
            Two-Headed Giant
          </Pressable>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text variant="bodyStrong">{isTeams ? 'Teams' : 'Players'}, in seat order</Text>
          <Button variant="secondary" onClick={shuffleSeats}>
            Randomize seats
          </Button>
        </div>
        <Text variant="body" color="muted">
          Seat order is how you sat to draft — round 1 pairs the players furthest apart.
        </Text>

        <ul className="flex flex-col gap-2">
          {entrants.map((entrant, index) => (
            <li key={entrant.key} className="flex items-end gap-2">
              <Text variant="label" color="muted" className="w-6 pb-4 text-right">
                {index + 1}
              </Text>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {entrant.members.map((member, memberIndex) => (
                  <TextField
                    key={memberIndex}
                    value={member}
                    onChange={(value) => setMember(entrant.key, memberIndex, value)}
                    label={
                      isTeams
                        ? `${entrantNoun} ${index + 1} player ${memberIndex + 1}`
                        : `${entrantNoun} ${index + 1}`
                    }
                    hideLabel
                    placeholder={isTeams ? `Player ${memberIndex + 1}` : `${entrantNoun} ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex shrink-0 gap-1">
                <Pressable
                  aria-label={`Move ${entrantNoun} ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="min-h-12 min-w-12 justify-center rounded-full border border-border text-text-muted disabled:text-disabled-text"
                >
                  <ChevronUpIcon />
                </Pressable>
                <Pressable
                  aria-label={`Move ${entrantNoun} ${index + 1} down`}
                  disabled={index === entrants.length - 1}
                  onClick={() => move(index, 1)}
                  className="min-h-12 min-w-12 justify-center rounded-full border border-border text-text-muted disabled:text-disabled-text"
                >
                  <ChevronDownIcon />
                </Pressable>
                <Pressable
                  aria-label={`Remove ${entrantNoun} ${index + 1}`}
                  disabled={entrants.length <= MIN_ENTRANTS}
                  onClick={() => removeEntrant(entrant.key)}
                  className="min-h-12 min-w-12 justify-center rounded-full border border-border text-text-muted disabled:text-disabled-text"
                >
                  <TrashIcon />
                </Pressable>
              </div>
            </li>
          ))}
        </ul>

        <Button variant="secondary" fullWidth onClick={addEntrant}>
          <span className="flex items-center justify-center gap-2">
            <PlusIcon />
            Add {entrantNoun.toLowerCase()}
          </span>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text variant="bodyStrong">Rounds</Text>
          <Stepper
            value={rounds}
            onChange={setRounds}
            label="Rounds"
            min={MIN_ROUNDS}
            max={MAX_ROUNDS}
          />
        </div>
        <Text variant="body" color="muted">
          {namedEntrants.length >= MIN_ENTRANTS
            ? `${recommendedRounds(namedEntrants.length)} recommended for ${namedEntrants.length} ${
                isTeams ? 'teams' : 'players'
              }.`
            : 'Add at least two entrants to start.'}
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <Text variant="bodyStrong">Match length</Text>
        <div
          role="group"
          aria-label="Match length"
          className="flex gap-1 rounded-pill border border-border bg-surface p-1"
        >
          <Pressable
            aria-pressed={format === 'bo3'}
            disabled={isTeams}
            onClick={() => setFormat('bo3')}
            className={`${segmentClasses} ${
              format === 'bo3' ? 'bg-accent text-accent-text' : 'text-text-muted'
            } disabled:text-disabled-text`}
          >
            Best of 3
          </Pressable>
          <Pressable
            aria-pressed={format === 'bo1'}
            disabled={isTeams}
            onClick={() => setFormat('bo1')}
            className={`${segmentClasses} ${
              format === 'bo1' ? 'bg-accent text-accent-text' : 'text-text-muted'
            } disabled:text-disabled-text`}
          >
            Best of 1
          </Pressable>
        </div>
        {isTeams && (
          <Text variant="body" color="muted">
            Two-Headed Giant is always best of 1.
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Button size="lg" fullWidth disabled={!canStart} onClick={() => submit(false)}>
          Start with this seating
        </Button>
        <Button variant="secondary" fullWidth disabled={!canStart} onClick={() => submit(true)}>
          Start with random pairings
        </Button>
      </div>
    </section>
  )
}
