import { Surface } from './Surface'
import { Text } from './Text'

interface StatTileProps {
  label: string
  value: number | string
  pending?: boolean
  /** Smaller type and padding, for strips that sit under card art as annotation
   * rather than as a peer panel (StatStrip's `compact`). */
  compact?: boolean
}

/** One non-hero output tile in the StatStrip -- the token-driven replacement for the
 * old StatBox. `pending` dims the value while a recalculation is in flight, without
 * ever blanking it (the last good value stays on screen). */
export function StatTile({ label, value, pending = false, compact = false }: StatTileProps) {
  return (
    <Surface
      level="base"
      radius="md"
      padded={false}
      className={`${compact ? 'px-2 py-1' : 'px-3 py-2'} ${pending ? 'opacity-60' : ''}`}
    >
      <Text as="div" variant={compact ? 'bodyStrong' : 'statTile'} className="text-center">
        {value}
      </Text>
      <Text as="div" variant="label" color="muted" className="text-center">
        {label}
      </Text>
    </Surface>
  )
}
