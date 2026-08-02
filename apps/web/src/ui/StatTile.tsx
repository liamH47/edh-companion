import { Surface } from './Surface'
import { Text } from './Text'

interface StatTileProps {
  label: string
  value: number | string
  pending?: boolean
}

/** One non-hero output tile in the StatStrip -- the token-driven replacement for the
 * old StatBox. `pending` dims the value while a recalculation is in flight, without
 * ever blanking it (the last good value stays on screen). */
export function StatTile({ label, value, pending = false }: StatTileProps) {
  return (
    <Surface level="base" radius="md" padded={false} className={`px-3 py-2 ${pending ? 'opacity-60' : ''}`}>
      <Text as="div" variant="statTile" className="text-center">
        {value}
      </Text>
      <Text as="div" variant="label" color="muted" className="text-center">
        {label}
      </Text>
    </Surface>
  )
}
