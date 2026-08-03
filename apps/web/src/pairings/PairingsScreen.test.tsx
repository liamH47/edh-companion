import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { savePodSession } from '@mtg/core/pods'
import { saveTournament } from '@mtg/core/swiss'
import { makeEntrants, makeTournament, match, round } from '@mtg/core/swiss/fixtures'
import { PairingsScreen } from './PairingsScreen'

afterEach(() => {
  localStorage.clear()
})

describe('PairingsScreen', () => {
  it('opens on the chooser when nothing is in progress', () => {
    render(<PairingsScreen />)
    expect(screen.getByRole('heading', { name: 'Pairings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commander pods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Swiss tournament' })).toBeInTheDocument()
  })

  it('enters the casual pods flow and can come back', async () => {
    const user = userEvent.setup()
    render(<PairingsScreen />)

    await user.click(screen.getByRole('button', { name: 'Commander pods' }))
    expect(screen.getByRole('heading', { name: 'Commander pods' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '‹ Pairings' }))
    expect(screen.getByRole('heading', { name: 'Pairings' })).toBeInTheDocument()
  })

  it('enters the Swiss flow and can come back', async () => {
    const user = userEvent.setup()
    render(<PairingsScreen />)

    await user.click(screen.getByRole('button', { name: 'Swiss tournament' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '‹ Pairings' }))
    expect(screen.getByRole('heading', { name: 'Pairings' })).toBeInTheDocument()
  })

  it('resumes a saved pod session straight into the pods flow', () => {
    savePodSession({
      players: [
        { id: 'player-1', name: 'Ava' },
        { id: 'player-2', name: 'Ben' },
        { id: 'player-3', name: 'Cara' },
      ],
      rounds: [
        { number: 1, hadToRepeatTable: false, pods: [{ seats: ['player-1', 'player-2', 'player-3'] }] },
      ],
    })
    render(<PairingsScreen />)
    expect(screen.getByRole('heading', { name: 'Round 1' })).toBeInTheDocument()
    expect(screen.getByText('Ava, Ben, Cara')).toBeInTheDocument()
  })

  it('resumes a saved tournament straight into the Swiss flow', () => {
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
      }),
    )
    render(<PairingsScreen />)
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
  })
})
