import { sequenceValue } from '@mtg/core'
import type { FieldSpec, MapSpec } from '@mtg/core'

/** Node box size and spacing, in viewBox units. Wide boxes, because room names are the
 * content -- a map of anonymous circles would make the player memorize the card. */
const NODE_WIDTH = 104
const NODE_HEIGHT = 40
const COLUMN_GAP = 34
const ROW_GAP = 14
const PADDING = 8

type NodeState = 'current' | 'visited' | 'next' | 'unreachable'

/** Room names longer than the box splits into two lines at the space nearest the
 * middle -- SVG text does not wrap on its own, and "Cradle of the Death God" at one
 * line overflows any box that leaves space for three columns on a phone. */
const ONE_LINE_LIMIT = 14

function splitLabel(label: string): string[] {
  if (label.length <= ONE_LINE_LIMIT) return [label]
  const middle = label.length / 2
  let best = -1
  for (let i = label.indexOf(' '); i !== -1; i = label.indexOf(' ', i + 1)) {
    if (best === -1 || Math.abs(i - middle) < Math.abs(best - middle)) best = i
  }
  if (best === -1) return [label]
  return [label.slice(0, best), label.slice(best + 1)]
}

interface Layout {
  x: number
  y: number
  id: string
}

/** Column/row -> centred viewBox coordinates. Columns render top-to-bottom: venturing
 * reads as descending into the dungeon, and depth is the axis a phone has room for. */
function layoutNodes(spec: MapSpec): { nodes: Layout[]; width: number; height: number } {
  // n <= 9 rooms, so counting siblings by scan beats carrying a Map whose get() the
  // type system cannot prove non-null.
  const rowsIn = (column: number) =>
    spec.nodes.reduce((count, node) => count + (node.column === column ? 1 : 0), 0)
  const widest = Math.max(...spec.nodes.map((node) => rowsIn(node.column)))
  const width = PADDING * 2 + widest * NODE_WIDTH + (widest - 1) * ROW_GAP
  const depth = Math.max(...spec.nodes.map((node) => node.column)) + 1
  const height = PADDING * 2 + depth * NODE_HEIGHT + (depth - 1) * COLUMN_GAP

  const nodes = spec.nodes.map((node) => {
    const rowCount = rowsIn(node.column)
    const rowSpan = rowCount * NODE_WIDTH + (rowCount - 1) * ROW_GAP
    const left = (width - rowSpan) / 2
    return {
      id: node.id,
      x: left + node.row * (NODE_WIDTH + ROW_GAP) + NODE_WIDTH / 2,
      y: PADDING + node.column * (NODE_HEIGHT + COLUMN_GAP) + NODE_HEIGHT / 2,
    }
  })
  return { nodes, width, height }
}

interface DungeonMapProps {
  field: FieldSpec
  value: unknown
  onChange: (name: string, value: unknown) => void
}

/**
 * The dungeon as a tappable map: rooms as boxes, arrows descending between them, the
 * walked trail lit. Tapping a legal next room ventures into it -- the map IS the input
 * control for a `map`-flagged sequence, dispatched from FieldControl the way `roll`
 * dispatches to DieRoller. Illegal rooms simply don't respond: the shape of the road
 * not taken stays visible (that is what a map shows that a picker cannot), it just
 * isn't tappable, matching the rules -- venture never moves backwards or teleports.
 *
 * One hand-written SVG (the blessed portable pattern): nodes carry onClick directly,
 * which react-native-svg's shapes support as onPress. State is never color alone --
 * current gets a marker ring and a caption, visited gets a check, unreachable is
 * muted AND aria-disabled.
 *
 * No animation: node-state changes are static, so there is nothing to gate under
 * reduced motion beyond the press feedback the primitives already handle.
 */
export function DungeonMap({ field, value, onChange }: DungeonMapProps) {
  const spec = field.map
  if (!spec) return null

  const entries = sequenceValue(value)
  const current = entries.length > 0 ? entries[entries.length - 1] : null
  const visited = new Set(entries)
  const labelForValue = new Map((field.options ?? []).map((option) => [option.value, option.label]))

  const successors = new Map<string, string[]>()
  for (const edge of spec.edges) {
    successors.set(edge.source, [...(successors.get(edge.source) ?? []), edge.target])
  }
  const legalNext = new Set(current === null ? [spec.entry] : (successors.get(current) ?? []))
  const atMax = field.max != null && entries.length >= field.max

  const stateOf = (id: string): NodeState => {
    if (id === current) return 'current'
    if (visited.has(id)) return 'visited'
    if (!atMax && legalNext.has(id)) return 'next'
    return 'unreachable'
  }

  /** The edge that was actually walked: consecutive entries. */
  const walked = new Set(entries.slice(1).map((room, index) => `${entries[index]}->${room}`))

  const { nodes, width, height } = layoutNodes(spec)
  const positionOf = new Map(nodes.map((node) => [node.id, node]))

  return (
    <div data-testid={`dungeon-map-${field.name}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="group"
        aria-label={field.label}
      >
        {/* Edges first, under the rooms. The walked trail is thicker and accented, so
            Dark Pool reached via Goblin Lair is visibly different from via Mine
            Tunnels -- the payoff of keeping the ordered walk over a bare pointer. */}
        {spec.edges.map((edge) => {
          const from = positionOf.get(edge.source)
          const to = positionOf.get(edge.target)
          if (!from || !to) return null
          const isWalked = walked.has(`${edge.source}->${edge.target}`)
          return (
            <line
              key={`${edge.source}->${edge.target}`}
              x1={from.x}
              y1={from.y + NODE_HEIGHT / 2}
              x2={to.x}
              y2={to.y - NODE_HEIGHT / 2}
              stroke={isWalked ? 'var(--color-accent)' : 'var(--color-border)'}
              strokeWidth={isWalked ? 3 : 1.5}
            />
          )
        })}

        {nodes.map((node) => {
          const state = stateOf(node.id)
          const label = labelForValue.get(node.id) ?? node.id
          const tappable = state === 'next'
          const fill =
            state === 'current'
              ? 'var(--color-accent)'
              : state === 'visited'
                ? 'var(--color-surface-raised)'
                : 'var(--color-surface)'
          const stroke =
            state === 'current' || state === 'next'
              ? 'var(--color-accent)'
              : 'var(--color-border)'
          const textFill =
            state === 'current'
              ? 'var(--color-accent-text)'
              : state === 'unreachable'
                ? 'var(--color-text-muted)'
                : 'var(--color-text)'
          return (
            <g
              key={node.id}
              role="button"
              aria-label={`${label}, ${state === 'next' ? 'venture here' : state}`}
              aria-disabled={tappable ? undefined : true}
              tabIndex={tappable ? 0 : undefined}
              style={tappable ? { cursor: 'pointer' } : undefined}
              onClick={
                tappable ? () => onChange(field.name, [...entries, node.id]) : undefined
              }
              onKeyDown={
                tappable
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onChange(field.name, [...entries, node.id])
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={node.x - NODE_WIDTH / 2}
                y={node.y - NODE_HEIGHT / 2}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill={fill}
                stroke={stroke}
                strokeWidth={state === 'current' ? 3 : 1.5}
                strokeDasharray={state === 'next' ? '5 3' : undefined}
              />
              {state === 'visited' && (
                <path
                  d={`M ${node.x + NODE_WIDTH / 2 - 16} ${node.y - NODE_HEIGHT / 2 + 12} l 3.5 3.5 l 6 -6`}
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
              )}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={splitLabel(label).length > 1 ? 10 : 11}
                fontWeight={state === 'current' ? 700 : 500}
                fill={textFill}
              >
                {splitLabel(label).map((line, index, lines) => (
                  <tspan
                    key={line}
                    x={node.x}
                    dy={index === 0 ? (lines.length > 1 ? -6 : 0) : 12}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          )
        })}
      </svg>
      {/* The caption doubles as the screen-reader anchor for where the marker sits. */}
      <p aria-live="polite" className="text-center text-sm text-text-muted">
        {current === null
          ? 'Not in this dungeon yet -- tap the first room to venture.'
          : `You are here: ${labelForValue.get(current) ?? current}`}
      </p>
    </div>
  )
}
