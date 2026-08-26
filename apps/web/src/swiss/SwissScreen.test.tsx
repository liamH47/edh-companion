import { render, screen, within } from '@testing-library/react'
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
    // A 4-pod seats 1v3 and 2v4, so Ava faces Cara -- and every player has an inline
    // tap target rather than a sheet behind a row.
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByRole('button', { name: 'Add a game win for Ava' })).toBeInTheDocument()
    expect(within(items[0]).getByRole('button', { name: 'Add a game win for Cara' })).toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'Add a game win for Ben' })).toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'Add a game win for Dev' })).toBeInTheDocument()
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

  it('resumes on the round in progress, not round 1', () => {
    // A refresh mid-event reloads the tournament from storage; the screen must come
    // back on the live round, or the TO reads it as lost data.
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [
          round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
          round(2, [match('entrant-1', 'entrant-2', null)]),
        ],
      }),
    )
    render(<SwissScreen />)
    expect(screen.getByRole('heading', { name: 'Round 2 of 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'R2' })).toHaveAttribute('aria-current', 'page')
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

    // 0-2 by taps: two game wins for B.
    await user.click(screen.getByRole('button', { name: 'Add a game win for B' }))
    await user.click(screen.getByRole('button', { name: 'Add a game win for B' }))
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

  it('ends the tournament back to a fresh setup screen, once confirmed', async () => {
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

    const dialog = screen.getByRole('dialog', { name: 'End the tournament?' })
    await user.click(within(dialog).getByRole('button', { name: 'End tournament' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
  })

  it('keeps the tournament when ending it is declined', async () => {
    // Standings for a whole event are discarded with no record kept, so this is the
    // most expensive button in the app to hit by accident.
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
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New tournament' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End tournament' })).toBeInTheDocument()
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
    // The first match is now C versus B: A is out of it entirely.
    const firstMatch = screen.getAllByRole('listitem')[0]
    expect(within(firstMatch).getByRole('button', { name: 'Add a game win for C' })).toBeInTheDocument()
    expect(within(firstMatch).getByRole('button', { name: 'Add a game win for B' })).toBeInTheDocument()
    expect(
      within(firstMatch).queryByRole('button', { name: 'Add a game win for A' }),
    ).not.toBeInTheDocument()
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
    // Correct a result on the past round: the banner offers re-pairing, which runs
    // behind a confirm since it discards later-round results.
    await user.click(screen.getByRole('button', { name: 'Remove a game win for A' }))
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))
    const dialog = screen.getByRole('dialog', { name: 'Re-pair later rounds?' })
    await user.click(within(dialog).getByRole('button', { name: 'Re-pair' }))

    // Round 2 still exists, rebuilt from the corrected standings.
    await user.click(screen.getByRole('button', { name: 'R2' }))
    expect(screen.getByRole('heading', { name: 'Round 2 of 3' })).toBeInTheDocument()
  })

  it('clears the re-pair offer when switching rounds', async () => {
    // key={showRound} remounts RoundScreen, so a banner raised on R1 must not follow
    // the TO onto R2 and back.
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
    await user.click(screen.getByRole('button', { name: 'Remove a game win for A' }))
    expect(screen.getByRole('button', { name: 'Re-pair later rounds' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'R2' }))
    await user.click(screen.getByRole('button', { name: 'R1' }))
    expect(screen.queryByRole('button', { name: 'Re-pair later rounds' })).not.toBeInTheDocument()
  })

  it('offers End tournament from the round view, not just the standings', async () => {
    // "Easily available at all times": ending the night must not require remembering
    // which tab the button lives on. Still behind the confirm either way.
    const user = userEvent.setup()
    saveTournament(
      makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', null)])],
      }),
    )
    render(<SwissScreen />)
    expect(screen.getByRole('heading', { name: 'Round 1 of 3' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'End tournament' }))
    const dialog = screen.getByRole('dialog', { name: 'End the tournament?' })
    await user.click(within(dialog).getByRole('button', { name: 'End tournament' }))
    expect(screen.getByRole('heading', { name: 'New tournament' })).toBeInTheDocument()
  })
})
