import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from '../core/swiss/fixtures'
import { StandingsScreen } from './StandingsScreen'

describe('StandingsScreen', () => {
  it('shows an empty state with no entrants', () => {
    render(<StandingsScreen tournament={makeTournament()} />)
    expect(screen.getByText('No entrants yet.')).toBeInTheDocument()
  })

  it('lists entrants in rank order with their records', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    render(<StandingsScreen tournament={tournament} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('A')
    expect(rows[0]).toHaveTextContent('1-0-0')
    expect(rows[1]).toHaveTextContent('B')
    expect(rows[1]).toHaveTextContent('0-1-0')
  })

  it('shows match points and all four tiebreakers', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2),
      rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
    })
    render(<StandingsScreen tournament={tournament} />)
    const winner = screen.getAllByRole('listitem')[0]
    expect(winner).toHaveTextContent('3 pts')
    expect(winner).toHaveTextContent('OMW')
    expect(winner).toHaveTextContent('GW 100.0%')
    expect(winner).toHaveTextContent('OGW')
  })

  it('marks a dropped entrant', () => {
    const tournament = makeTournament({
      entrants: makeEntrants(2).map((e) =>
        e.id === 'entrant-2' ? { ...e, droppedAfterRound: 1 } : e,
      ),
    })
    render(<StandingsScreen tournament={tournament} />)
    expect(screen.getByText(/\(dropped\)/)).toBeInTheDocument()
  })

  it('joins both members of a Two-Headed Giant team', () => {
    const tournament = makeTournament({
      mode: 'two-headed-giant',
      entrants: [
        { id: 'entrant-1', members: ['A', 'B'], seat: 1, droppedAfterRound: null },
        { id: 'entrant-2', members: ['C', 'D'], seat: 2, droppedAfterRound: null },
      ],
    })
    render(<StandingsScreen tournament={tournament} />)
    expect(screen.getByText(/A & B/)).toBeInTheDocument()
  })
})
