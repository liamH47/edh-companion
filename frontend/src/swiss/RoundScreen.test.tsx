import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from '../core/swiss/fixtures'
import { RoundScreen } from './RoundScreen'

function renderRound(overrides: Partial<Parameters<typeof RoundScreen>[0]> = {}) {
  const props = {
    tournament: makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', null),
          match('entrant-3', 'entrant-4', null),
        ]),
      ],
    }),
    roundNumber: 1,
    hadToRepeatPairing: false,
    onReport: vi.fn(),
    onRepairFrom: vi.fn(),
    onSwap: vi.fn(),
    onNextRound: vi.fn(),
    ...overrides,
  }
  render(<RoundScreen {...props} />)
  return props
}

describe('RoundScreen', () => {
  it('says so when the round has not started', () => {
    renderRound({ roundNumber: 9 })
    expect(screen.getByText(/hasn't started yet/)).toBeInTheDocument()
  })

  it('shows the round number out of the total', () => {
    renderRound()
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
  })

  it('lists each pairing with both names', () => {
    renderRound()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getAllByText('Not reported')).toHaveLength(2)
  })

  it('marks the round in progress until every match is reported', () => {
    renderRound()
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('marks the round complete once every match is reported', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    })
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('shows a reported scoreline', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 1))])],
      }),
    })
    expect(screen.getByText('2-1')).toBeInTheDocument()
  })

  it('shows a drawn match as a draw rather than a scoreline', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(1, 1, 1))])],
      }),
    })
    expect(screen.getByText('Draw')).toBeInTheDocument()
  })

  it('shows a bye and makes it unreportable', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(1),
        rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
      }),
    })
    expect(screen.getByText('Bye')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Report A versus Bye/ })).toBeDisabled()
  })

  it('opens the result sheet for a real match', async () => {
    const user = userEvent.setup()
    renderRound()
    await user.click(screen.getByRole('button', { name: 'Report A versus B' }))
    expect(screen.getByRole('dialog', { name: 'Report result' })).toBeInTheDocument()
  })

  it('reports the chosen result for that match', async () => {
    const user = userEvent.setup()
    const props = renderRound()
    await user.click(screen.getByRole('button', { name: 'Report A versus B' }))
    await user.click(screen.getByRole('button', { name: '2-0' }))
    expect(props.onReport).toHaveBeenCalledWith(1, 'entrant-1-vs-entrant-2', {
      gameWins: [2, 0],
      gameDraws: 0,
    })
  })

  it('warns when the pairing had to be repeated', () => {
    renderRound({ hadToRepeatPairing: true })
    expect(screen.getByRole('alert')).toHaveTextContent(/repeats a pairing/)
  })

  it('does not warn when the pairing was clean', () => {
    renderRound()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers the next round only once this one is complete', () => {
    renderRound()
    expect(screen.queryByRole('button', { name: /Start round 2/ })).not.toBeInTheDocument()
  })

  it('offers the next round when complete and rounds remain', async () => {
    const user = userEvent.setup()
    const props = renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Start round 2' }))
    expect(props.onNextRound).toHaveBeenCalled()
  })

  it('does not offer another round once the tournament is played out', () => {
    renderRound({
      tournament: makeTournament({
        totalRounds: 1,
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    })
    expect(screen.queryByRole('button', { name: /Start round/ })).not.toBeInTheDocument()
  })


  it('swaps two entrants between matches', async () => {
    const user = userEvent.setup()
    const props = renderRound()
    await user.click(screen.getByRole('button', { name: /Swap A with another entrant/ }))
    await user.click(screen.getByRole('button', { name: 'C' }))
    expect(props.onSwap).toHaveBeenCalledWith(1, 'entrant-1', 'entrant-3')
  })

  it('closes the swap sheet without swapping when dismissed', async () => {
    const user = userEvent.setup()
    const props = renderRound()
    await user.click(screen.getByRole('button', { name: /Swap A with another entrant/ }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.onSwap).not.toHaveBeenCalled()
  })

  it('hides the swap control once the round is complete', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    })
    expect(screen.queryByRole('button', { name: /Swap/ })).not.toBeInTheDocument()
  })

  it('offers re-pairing when a later round was built from this one', async () => {
    const user = userEvent.setup()
    const props = renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [
          round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
          round(2, [match('entrant-2', 'entrant-1', null)]),
        ],
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Report A versus B' }))
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))
    expect(props.onRepairFrom).toHaveBeenCalledWith(1)
  })
})
