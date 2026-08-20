import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSpec, MapSpec } from '@mtg/core'
import { DungeonMap } from './DungeonMap'

/** Lost Mine's top half: an entry forking to two rooms that share a successor --
 * enough graph to exercise every node state, including the road not taken. */
const MAP: MapSpec = {
  entry: 'cave',
  scryfall_id: null,
  nodes: [
    { id: 'cave', column: 0, row: 0, art: null },
    { id: 'lair', column: 1, row: 0, art: null },
    { id: 'tunnels', column: 1, row: 1, art: null },
    { id: 'pool', column: 2, row: 0, art: null },
  ],
  edges: [
    { source: 'cave', target: 'lair' },
    { source: 'cave', target: 'tunnels' },
    { source: 'lair', target: 'pool' },
    { source: 'tunnels', target: 'pool' },
  ],
}

function mappedField(overrides: Partial<FieldSpec> = {}): FieldSpec {
  return {
    name: 'path',
    label: 'Your path',
    kind: 'sequence',
    default: [],
    min: null,
    max: 3,
    options: [
      { value: 'cave', label: 'Cave Entrance' },
      { value: 'lair', label: 'Goblin Lair' },
      { value: 'tunnels', label: 'Mine Tunnels' },
      { value: 'pool', label: 'Dark Pool' },
    ],
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    map: MAP,
    new_turn_carries_output: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

describe('DungeonMap', () => {
  it('renders every room and every edge', () => {
    render(<DungeonMap field={mappedField()} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Your path' })).toBeInTheDocument()
    expect(document.querySelectorAll('rect')).toHaveLength(4)
    expect(document.querySelectorAll('line')).toHaveLength(4)
  })

  it('offers only the entry before the first venture', () => {
    render(<DungeonMap field={mappedField()} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cave Entrance, venture here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Goblin Lair, unreachable' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByText('Not in this dungeon yet -- tap the first room to venture.'))
      .toBeInTheDocument()
  })

  it('ventures by tapping a legal next room', () => {
    const onChange = vi.fn()
    render(<DungeonMap field={mappedField()} value={['cave']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goblin Lair, venture here' }))
    expect(onChange).toHaveBeenCalledWith('path', ['cave', 'lair'])
  })

  it('supports the keyboard on legal rooms', () => {
    const onChange = vi.fn()
    render(<DungeonMap field={mappedField()} value={[]} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cave Entrance, venture here' }), {
      key: 'Enter',
    })
    expect(onChange).toHaveBeenCalledWith('path', ['cave'])
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cave Entrance, venture here' }), {
      key: ' ',
    })
    expect(onChange).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cave Entrance, venture here' }), {
      key: 'Escape',
    })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('ignores taps on unreachable rooms -- the road not taken stays not taken', () => {
    const onChange = vi.fn()
    render(<DungeonMap field={mappedField()} value={['cave', 'lair']} onChange={onChange} />)
    // Mine Tunnels was the other fork; it stays visible but inert.
    fireEvent.click(screen.getByRole('button', { name: 'Mine Tunnels, unreachable' }))
    // The current room is not a legal destination either (no backwards, no standing still).
    fireEvent.click(screen.getByRole('button', { name: 'Goblin Lair, current' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks the walked trail: visited rooms check, walked edges thicken', () => {
    render(
      <DungeonMap field={mappedField()} value={['cave', 'lair', 'pool']} onChange={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Cave Entrance, visited' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark Pool, current' })).toBeInTheDocument()
    expect(screen.getByText('You are here: Dark Pool')).toBeInTheDocument()
    const lines = [...document.querySelectorAll('line')]
    const walked = lines.filter((line) => line.getAttribute('stroke') === 'var(--color-accent)')
    // cave->lair and lair->pool are walked; cave->tunnels and tunnels->pool are not.
    expect(walked).toHaveLength(2)
  })

  it('stops offering rooms at the field cap', () => {
    // max = 3 and three rooms walked: nothing further is tappable even though pool
    // would otherwise have successors in a longer graph.
    render(
      <DungeonMap field={mappedField()} value={['cave', 'tunnels', 'pool']} onChange={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /venture here/ })).not.toBeInTheDocument()
  })

  it('falls back to room ids when a label is missing, and skips a dangling edge', () => {
    // The schema forbids both shapes, but the component is generic and must not crash
    // on data it did not validate itself.
    render(
      <DungeonMap
        field={mappedField({
          options: null,
          map: { ...MAP, edges: [...MAP.edges, { source: 'cave', target: 'basement' }] },
        })}
        value={['cave']}
        onChange={() => {}}
      />,
    )
    // MAP names no card, so the drawn variant renders directly -- no image to load.
    // Labels degrade to ids.
    expect(screen.getByRole('button', { name: 'cave, current' })).toBeInTheDocument()
    expect(screen.getByText('You are here: cave')).toBeInTheDocument()
    // The dangling edge draws nothing; the four real ones survive.
    expect(document.querySelectorAll('line')).toHaveLength(4)
  })

  it('wraps long room names onto two lines, splitting at the space nearest the middle', () => {
    render(
      <DungeonMap
        field={mappedField({
          options: [
            { value: 'cave', label: 'Cradle of the Death God' },
            { value: 'lair', label: 'Goblin Lair' },
            { value: 'tunnels', label: 'Unbreakable-Hyphenated-Name' },
            { value: 'pool', label: 'Dark Pool' },
          ],
        })}
        value={[]}
        onChange={() => {}}
      />,
    )
    // Two tspans for the long spaced name...
    const spans = [...document.querySelectorAll('tspan')].map((t) => t.textContent)
    expect(spans).toContain('Cradle of the')
    expect(spans).toContain('Death God')
    // ...but a long name with no space to split at stays whole.
    expect(spans).toContain('Unbreakable-Hyphenated-Name')
    expect(spans).toContain('Goblin Lair')
  })

  it('renders nothing for a field without a map', () => {
    const { container } = render(
      <DungeonMap field={mappedField({ map: null })} value={[]} onChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})


/** The same fork, annotated with printed-card boxes. */
const ART_MAP: MapSpec = {
  ...MAP,
  scryfall_id: '59b11ff8-f118-4978-87dd-509dc0c8c932',
  nodes: [
    { id: 'cave', column: 0, row: 0, art: { x: 0.1, y: 0.15, w: 0.8, h: 0.1 } },
    { id: 'lair', column: 1, row: 0, art: { x: 0.1, y: 0.3, w: 0.35, h: 0.15 } },
    { id: 'tunnels', column: 1, row: 1, art: { x: 0.55, y: 0.3, w: 0.35, h: 0.15 } },
    { id: 'pool', column: 2, row: 0, art: { x: 0.1, y: 0.5, w: 0.8, h: 0.12 } },
  ],
}

describe('DungeonMap with card art', () => {
  it('renders the printed card with a positioned tap target per room', () => {
    render(<DungeonMap field={mappedField({ map: ART_MAP })} value={[]} onChange={() => {}} />)
    expect(screen.getByAltText('The dungeon, as printed')).toBeInTheDocument()
    // The tap targets wait for the pixels.
    expect(screen.queryByRole('button', { name: 'Cave Entrance, venture here' })).not.toBeInTheDocument()
    fireEvent.load(screen.getByAltText('The dungeon, as printed'))
    const entry = screen.getByRole('button', { name: 'Cave Entrance, venture here' })
    expect(entry.style.left).toBe('10%')
    expect(entry.style.top).toBe('15%')
    expect(entry.style.width).toBe('80%')
    // No drawn map: the card is the surface.
    expect(document.querySelectorAll('svg')).toHaveLength(0)
  })

  it('ventures by tapping the printed room and marks the current one', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DungeonMap field={mappedField({ map: ART_MAP })} value={[]} onChange={onChange} />,
    )
    fireEvent.load(screen.getByAltText('The dungeon, as printed'))
    fireEvent.click(screen.getByRole('button', { name: 'Cave Entrance, venture here' }))
    expect(onChange).toHaveBeenCalledWith('path', ['cave'])

    rerender(<DungeonMap field={mappedField({ map: ART_MAP })} value={['cave']} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Cave Entrance, current' })).toBeInTheDocument()
    expect(screen.getByText('You are here: Cave Entrance')).toBeInTheDocument()
    // Unreachable printed rooms are real disabled buttons -- inert by construction.
    expect(screen.getByRole('button', { name: 'Dark Pool, unreachable' })).toBeDisabled()
  })

  it('falls back to the drawn map when the card image cannot load', () => {
    render(<DungeonMap field={mappedField({ map: ART_MAP })} value={[]} onChange={() => {}} />)
    fireEvent.error(screen.getByAltText('The dungeon, as printed'))
    // The drawn SVG map takes over; the img is gone.
    expect(screen.queryByAltText('The dungeon, as printed')).not.toBeInTheDocument()
    expect(document.querySelectorAll('svg')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Cave Entrance, venture here' })).toBeInTheDocument()
  })

  it('marks visited rooms on the card with a check badge', () => {
    render(
      <DungeonMap
        field={mappedField({ map: ART_MAP })}
        value={['cave', 'lair', 'pool']}
        onChange={() => {}}
      />,
    )
    fireEvent.load(screen.getByAltText('The dungeon, as printed'))
    expect(screen.getByRole('button', { name: 'Cave Entrance, visited' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark Pool, current' })).toBeInTheDocument()
  })
})


describe('DungeonMap with card art, defensive shapes', () => {
  it('skips an un-annotated room and degrades labels to ids', () => {
    // The schema forbids both (art is all-or-nothing, options mirror nodes), but the
    // component is generic and must not crash on data it did not validate itself.
    const patchy: MapSpec = {
      ...ART_MAP,
      nodes: ART_MAP.nodes.map((node) => (node.id === 'pool' ? { ...node, art: null } : node)),
    }
    render(
      <DungeonMap
        field={mappedField({ map: patchy, options: null })}
        value={['cave']}
        onChange={() => {}}
      />,
    )
    fireEvent.load(screen.getByAltText('The dungeon, as printed'))
    // Labels degrade to ids; the un-annotated room simply has no tap target.
    expect(screen.getByRole('button', { name: 'cave, current' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pool/ })).not.toBeInTheDocument()
    expect(screen.getByText('You are here: cave')).toBeInTheDocument()
  })
})
