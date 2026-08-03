import { useState } from 'react'
import { loadPodSession } from '@mtg/core/pods'
import { loadTournament, type Rng } from '@mtg/core/swiss'
import { Pressable } from '../ui/Pressable'
import { Text } from '../ui/Text'
import { PodsScreen } from '../pods/PodsScreen'
import { SwissScreen } from '../swiss/SwissScreen'

type Mode = 'choose' | 'pods' | 'swiss'

/**
 * Resume whatever was already running rather than dropping a returning user on the
 * chooser: a saved pod session or tournament means the night is mid-flight. Pods win a
 * tie only because that's this tab's headline flow -- in practice only one is ever saved.
 */
function initialMode(): Mode {
  if (loadPodSession() !== null) return 'pods'
  if (loadTournament() !== null) return 'swiss'
  return 'choose'
}

interface PairingsScreenProps {
  /** Injected in tests so shuffles and pairings are reproducible. */
  rng?: Rng
}

interface ChoiceProps {
  title: string
  description: string
  onClick: () => void
}

function Choice({ title, description, onClick }: ChoiceProps) {
  return (
    <Pressable
      aria-label={title}
      onClick={onClick}
      className="min-h-12 flex-col items-start gap-1 rounded-lg border border-border bg-surface px-4 py-4"
    >
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="body" color="muted" className="text-left">
        {description}
      </Text>
    </Pressable>
  )
}

/**
 * The Pairings tab. Most Commander meetups don't run Swiss, so the tab opens on a
 * chooser with casual pods as the headline option and the full Swiss tournament kept a
 * tap away. Each flow owns its own session; this screen only remembers which one is open.
 */
export function PairingsScreen({ rng = Math.random }: PairingsScreenProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode)

  if (mode === 'pods') {
    return <PodsScreen rng={rng} onBack={() => setMode('choose')} />
  }
  if (mode === 'swiss') {
    return <SwissScreen rng={rng} onExit={() => setMode('choose')} />
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Text as="h2" variant="title">
          Pairings
        </Text>
        <Text variant="body" color="muted">
          Pick how you&apos;re running the night.
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        <Choice
          title="Commander pods"
          description="Split the group into pods and reshuffle each round so people meet new opponents. No scoring."
          onClick={() => setMode('pods')}
        />
        <Choice
          title="Swiss tournament"
          description="Report every match, with standings and MTR tiebreakers. For 1v1, Two-Headed Giant or podded Commander."
          onClick={() => setMode('swiss')}
        />
      </div>
    </section>
  )
}
