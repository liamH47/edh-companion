import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PodRound, PodSession } from '@mtg/core/pods'
import { PodRoundScreen } from './PodRoundScreen'

const session: PodSession = {
  players: [
    { id: 'player-1', name: 'Ava' },
    { id: 'player-2', name: 'Ben' },
    { id: 'player-3', name: 'Cara' },
    { id: 'player-4', name: 'Dev' },
    { id: 'player-5', name: 'Eve' },
    { id: 'player-6', name: 'Fin' },
  ],
  rounds: [],
}

const round: PodRound = {
  number: 2,
  hadToRepeatTable: false,
  pods: [
    { seats: ['player-1', 'player-2', 'player-3'] },
    { seats: ['player-4', 'player-5', 'player-6'] },
  ],
}

function renderRound(overrides: Partial<Parameters<typeof PodRoundScreen>[0]> = {}) {
  const onNextRound = vi.fn()
  const onReshuffle = vi.fn()
  render(
    <PodRoundScreen
      session={session}
      round={round}
      isLatest
      onNextRound={onNextRound}
      onReshuffle={onReshuffle}
      {...overrides}
    />,
  )
  return { onNextRound, onReshuffle }
}

describe('PodRoundScreen', () => {
  it('lists every pod with its members', () => {
    renderRound()
    expect(screen.getByRole('heading', { name: 'Round 2' })).toBeInTheDocument()
    expect(screen.getByText('Ava, Ben, Cara')).toBeInTheDocument()
    expect(screen.getByText('Dev, Eve, Fin')).toBeInTheDocument()
    expect(screen.getAllByText(/Pod \d · 3 players/)).toHaveLength(2)
  })

  it('drives new round and reshuffle from the latest round', async () => {
    const user = userEvent.setup()
    const { onNextRound, onReshuffle } = renderRound()

    await user.click(screen.getByRole('button', { name: 'New round' }))
    await user.click(screen.getByRole('button', { name: 'Reshuffle this round' }))

    expect(onNextRound).toHaveBeenCalled()
    expect(onReshuffle).toHaveBeenCalled()
  })

  it('hides the actions when viewing an earlier round', () => {
    renderRound({ isLatest: false })
    expect(screen.queryByRole('button', { name: 'New round' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reshuffle this round' })).not.toBeInTheDocument()
  })

  it('warns when a round had to repeat tablemates', () => {
    renderRound({ round: { ...round, hadToRepeatTable: true } })
    expect(screen.getByRole('alert')).toHaveTextContent('repeats some tablemates')
  })

  it('falls back to the id when a seat has no matching player name', () => {
    renderRound({
      round: { number: 1, hadToRepeatTable: false, pods: [{ seats: ['ghost'] }] },
    })
    expect(screen.getByText('ghost')).toBeInTheDocument()
  })
})
