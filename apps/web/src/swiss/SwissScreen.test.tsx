import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { makeEntrants, makeTournament, match, result, round } from '@mtg/core/swiss/fixtures'
import { saveTournament } from '@mtg/core/swiss'
import { SwissScreen } from './SwissScreen'

afterEach(() => {
  localStorage.clear()
})

async function startFourPlayerTournament(user: ReturnType<typeof userEvent.setup>) {
  for (const [index, name] of ['Ava', 'Ben', 'Cara', 'Dev'].entries()) {
    await user.type(screen.getByRole('textbox', { name: `Player ${index + 1}` }), name)
  }
  await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
}

describe('SwissScreen', () => {
  it('shows setup when no tournament is in progress', () => {
    render(<SwissScreen />)
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
  })

  it('starts a tournament and pairs round 1 by draft seating', async () => {
    const user = userEvent.setup()
    render(<SwissScreen />)
    await startFourPlayerTournament(user)

    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
    // A 4-pod seats 1v3 and 2v4, so Ava faces Cara.
    expect(screen.getByRole('button', { name: 'Report Ava versus Cara' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report Ben versus Dev' })).toBeInTheDocument()
  })

  it('resumes a tournament already in progress', () => {
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
      }),
    )
    render(<SwissScreen />)
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
  })

  it('switches between the round and the standings', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    )
    render(<SwissScreen />)

    await user.click(screen.getByRole('button', { name: 'Standings' }))
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'R1' }))
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
  })

  it('reports a result and reflects it in the standings', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
      }),
    )
    render(<SwissScreen />)

    await user.click(screen.getByRole('button', { name: 'Report A versus B' }))
    await user.click(screen.getByRole('button', { name: '0-2' }))
    await user.click(screen.getByRole('button', { name: 'Standings' }))

    // B won, so B is top of the table.
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('B')
  })

  it('advances to the next round once the current one is done', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(4),
        rounds: [
          round(1, [
            match('entrant-1', 'entrant-2', result(2, 0)),
            match('entrant-3', 'entrant-4', result(2, 0)),
          ]),
        ],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: 'Start round 2' }))
    expect(screen.getByRole('heading', { name: 'Round 2 of 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'R2' })).toBeInTheDocument()
  })

  it('drops an entrant and can put them back', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: 'Standings' }))
    await user.click(screen.getByRole('button', { name: 'Manage drops' }))

    await user.click(screen.getByRole('button', { name: /^A\s*Drop$/ }))
    expect(screen.getByRole('button', { name: /A\s*Dropped/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /A\s*Dropped/ }))
    expect(screen.getByRole('button', { name: /^A\s*Drop$/ })).toBeInTheDocument()
  })

  it('closes the drops sheet when dismissed', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: 'Standings' }))
    await user.click(screen.getByRole('button', { name: 'Manage drops' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ends the tournament back to a fresh setup screen', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: 'Standings' }))
    await user.click(screen.getByRole('button', { name: 'End tournament' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
  })

  it('pairs round 1 at random when started that way', async () => {
    const user = userEvent.setup()
    render(<SwissScreen />)
    for (const [index, name] of ['Ava', 'Ben'].entries()) {
      await user.type(screen.getByRole('textbox', { name: `Player ${index + 1}` }), name)
    }
    await user.click(screen.getByRole('button', { name: 'Start with random pairings' }))
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()
  })

  it('swaps two entrants from the round screen', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(4),
        rounds: [
          round(1, [
            match('entrant-1', 'entrant-2', null),
            match('entrant-3', 'entrant-4', null),
          ]),
        ],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: /Swap A with another entrant/ }))
    await user.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByRole('button', { name: 'Report C versus B' })).toBeInTheDocument()
  })

  it('re-pairs later rounds when a corrected result asks for it', async () => {
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(4),
        rounds: [
          round(1, [
            match('entrant-1', 'entrant-2', result(2, 0)),
            match('entrant-3', 'entrant-4', result(2, 0)),
          ]),
          round(2, [
            match('entrant-1', 'entrant-3', null),
            match('entrant-2', 'entrant-4', null),
          ]),
        ],
      }),
    )
    render(<SwissScreen />)
    await user.click(screen.getByRole('button', { name: 'R1' }))
    await user.click(screen.getByRole('button', { name: 'Report A versus B' }))
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))

    // Round 2 still exists, rebuilt from the (unchanged here) standings.
    await user.click(screen.getByRole('button', { name: 'R2' }))
    expect(screen.getByRole('heading', { name: 'Round 2 of 3' })).toBeInTheDocument()
  })
})
