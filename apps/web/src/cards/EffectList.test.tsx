import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EffectLine } from '@mtg/core'
import { EffectList } from './EffectList'

const LINES: EffectLine[] = [
  { source: 'Lotus Cobra', effect: 'Add one mana of any color', note: '3 mana' },
  {
    source: 'Tannuk, Memorial Ensign',
    effect: '1 damage to each opponent (2nd resolution also draws)',
    note: '1 card · 3 damage to each opponent · 2nd resolution drew a card',
  },
]

describe('EffectList', () => {
  it('renders one row per source, with its effect and running total', () => {
    render(<EffectList label="What each land drop does" lines={LINES} pending={false} emptyLabel="Nothing yet." />)
    expect(screen.getByText('Add one mana of any color')).toBeInTheDocument()
    expect(screen.getByText('3 mana')).toBeInTheDocument()
    expect(screen.getByText('Lotus Cobra')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('announces the whole list, since one land drop changes every row at once', () => {
    render(<EffectList label="What each land drop does" lines={LINES} pending={false} emptyLabel="Nothing yet." />)
    expect(screen.getByRole('list', { name: 'What each land drop does' })).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })

  it('shows the empty label instead of an empty list', () => {
    render(<EffectList label="Effects" lines={[]} pending={false} emptyLabel="Add what you control." />)
    expect(screen.getByText('Add what you control.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('dims while a recalculation is in flight without blanking the rows', () => {
    const { container } = render(
      <EffectList label="Effects" lines={LINES} pending emptyLabel="Nothing yet." />,
    )
    expect(container.firstChild).toHaveClass('opacity-60')
    expect(screen.getByText('Add one mana of any color')).toBeInTheDocument()
  })
})
