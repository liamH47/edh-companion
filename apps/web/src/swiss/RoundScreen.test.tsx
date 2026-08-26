import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeEntrants, makeTournament, match, pod, podResult, result, round } from '@mtg/core/swiss/fixtures'
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

/** A round-1-edited, round-2-exists tournament -- the shape that offers re-pairing. */
function tournamentWithLaterRound() {
  return makeTournament({
    entrants: makeEntrants(2),
    rounds: [
      round(1, [match('entrant-1', 'entrant-2', result(2, 0))]),
      round(2, [match('entrant-2', 'entrant-1', null)]),
    ],
  })
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

  it('lists each pairing as an inline score card with a tap target per player', () => {
    renderRound()
    for (const name of ['A', 'B', 'C', 'D']) {
      expect(screen.getByRole('button', { name: `Add a game win for ${name}` })).toBeInTheDocument()
    }
    expect(screen.getAllByText('Not reported')).toHaveLength(2)
  })

  it('reports a game win with the exact payload when a name is tapped', async () => {
    const user = userEvent.setup()
    const props = renderRound()
    await user.click(screen.getByRole('button', { name: 'Add a game win for A' }))
    expect(props.onReport).toHaveBeenCalledWith(1, 'entrant-1-vs-entrant-2', {
      gameWins: [1, 0],
      gameDraws: 0,
    })
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

  it('shows a reported scoreline on the card', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 1))])],
      }),
    })
    expect(screen.getByText('2-1')).toBeInTheDocument()
  })

  it('renders a bye as a static row with no controls at all', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(1),
        rounds: [round(1, [match('entrant-1', null, result(2, 0))])],
      }),
    })
    expect(screen.getByText('Bye')).toBeInTheDocument()
    // Pre-reported 2-0 by MTR; nothing about it is editable, so the row offers no
    // win, draw or swap control. ("Start round 2" still renders below the list -- a
    // bye-only round is complete by construction.)
    expect(screen.queryByRole('button', { name: /game win|won$|draw|Swap/i })).not.toBeInTheDocument()
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

  it('falls back to the raw id rather than crashing when a match names an unknown entrant', () => {
    // A stale or hand-edited saved tournament can carry a match id that is no longer in
    // the entrants list. That must degrade to a bare id, not throw through the top-level
    // ErrorBoundary and blank the whole app.
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2),
        rounds: [round(1, [match('entrant-1', 'entrant-999', null)])],
      }),
    })
    expect(screen.getByText('entrant-999')).toBeInTheDocument()
  })

  it('reports an empty field instead of offering a round when everyone has dropped', () => {
    renderRound({
      tournament: makeTournament({
        entrants: makeEntrants(2).map((entrant) => ({ ...entrant, droppedAfterRound: 1 })),
        rounds: [round(1, [match('entrant-1', 'entrant-2', result(2, 0))])],
      }),
    })
    expect(screen.queryByRole('button', { name: /Start round/ })).not.toBeInTheDocument()
    expect(screen.getByText(/no field left to pair/)).toBeInTheDocument()
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
})

describe('the re-pair banner', () => {
  it('does not dangle a destructive offer from merely looking at an old round', () => {
    renderRound({ tournament: tournamentWithLaterRound(), roundNumber: 1 })
    expect(screen.queryByRole('button', { name: 'Re-pair later rounds' })).not.toBeInTheDocument()
  })

  it('does not appear for edits on the latest round, which nothing was paired from', async () => {
    const user = userEvent.setup()
    renderRound()
    await user.click(screen.getByRole('button', { name: 'Add a game win for A' }))
    expect(screen.queryByRole('button', { name: 'Re-pair later rounds' })).not.toBeInTheDocument()
  })

  it('appears after a result edit on a round with later rounds', async () => {
    const user = userEvent.setup()
    renderRound({ tournament: tournamentWithLaterRound(), roundNumber: 1 })
    await user.click(screen.getByRole('button', { name: 'Remove a game win for A' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Later rounds were already paired/)
    expect(screen.getByRole('button', { name: 'Re-pair later rounds' })).toBeInTheDocument()
  })

  it('appears after a swap on a round with later rounds', async () => {
    // Possible once a decrement makes the earlier round incomplete again -- a swap
    // invalidates later pairings the same way a corrected result does.
    const user = userEvent.setup()
    const tournament = makeTournament({
      entrants: makeEntrants(4),
      rounds: [
        round(1, [
          match('entrant-1', 'entrant-2', null),
          match('entrant-3', 'entrant-4', null),
        ]),
        round(2, [
          match('entrant-1', 'entrant-3', null),
          match('entrant-2', 'entrant-4', null),
        ]),
      ],
    })
    renderRound({ tournament, roundNumber: 1 })
    await user.click(screen.getByRole('button', { name: /Swap A with another entrant/ }))
    await user.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByRole('button', { name: 'Re-pair later rounds' })).toBeInTheDocument()
  })

  it('re-pairs only after the confirmation is accepted', async () => {
    const user = userEvent.setup()
    const props = renderRound({ tournament: tournamentWithLaterRound(), roundNumber: 1 })
    await user.click(screen.getByRole('button', { name: 'Remove a game win for A' }))
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))
    expect(props.onRepairFrom).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog', { name: 'Re-pair later rounds?' })
    await user.click(within(dialog).getByRole('button', { name: 'Re-pair' }))
    expect(props.onRepairFrom).toHaveBeenCalledWith(1)
    // Acted on: the offer is spent.
    expect(screen.queryByRole('button', { name: 'Re-pair later rounds' })).not.toBeInTheDocument()
  })

  it('keeps the offer when the confirmation is declined', async () => {
    const user = userEvent.setup()
    const props = renderRound({ tournament: tournamentWithLaterRound(), roundNumber: 1 })
    await user.click(screen.getByRole('button', { name: 'Remove a game win for A' }))
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(props.onRepairFrom).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Re-pair later rounds' })).toBeInTheDocument()
  })
})

describe('RoundScreen with Commander pods', () => {
  const POD_TOURNAMENT = makeTournament({
    eventFormat: 'commander',
    format: 'bo1',
    entrants: makeEntrants(7),
    rounds: [
      round(1, [
        pod(['entrant-1', 'entrant-2', 'entrant-3', 'entrant-4']),
        pod(['entrant-5', 'entrant-6', 'entrant-7']),
      ]),
    ],
  })

  it('gives every pod member their own set-winner tap target', () => {
    renderRound({ tournament: POD_TOURNAMENT })
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      expect(screen.getByRole('button', { name: `${name} won` })).toBeInTheDocument()
    }
  })

  it('reports the pod winner with the single-1 shape', async () => {
    const user = userEvent.setup()
    const props = renderRound({ tournament: POD_TOURNAMENT })
    await user.click(screen.getByRole('button', { name: 'C won' }))
    expect(props.onReport).toHaveBeenCalledWith(
      1,
      'entrant-1-vs-entrant-2-vs-entrant-3-vs-entrant-4',
      { gameWins: [0, 0, 1, 0], gameDraws: 0 },
    )
  })

  it('shows the winner by name rather than a scoreline once a pod is reported', () => {
    const reported = makeTournament({
      eventFormat: 'commander',
      format: 'bo1',
      entrants: makeEntrants(3),
      rounds: [round(1, [pod(['entrant-1', 'entrant-2', 'entrant-3'], podResult(3, 1))])],
    })
    renderRound({ tournament: reported })
    // gameWins [0,1,0] -> B won; readable, not "0-1-0".
    expect(screen.getByText('B won')).toBeInTheDocument()
  })
})
