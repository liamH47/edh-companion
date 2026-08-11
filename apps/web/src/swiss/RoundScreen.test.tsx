import { render, screen } from '@testing-library/react'
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

  it('lists a pod at one weight, with nobody promoted above the rest', () => {
    // A 1v1 stacks the two sides because the scoreline reads from the top one. A pod
    // has no such hierarchy, so showing the first member as a headline would imply
    // one that does not exist.
    renderRound({ tournament: POD_TOURNAMENT })

    expect(screen.getByText('A, B, C, D')).toBeInTheDocument()
    expect(screen.getByText('E, F, G')).toBeInTheDocument()
  })

  it('still stacks the two sides of an ordinary 1v1 match', () => {
    renderRound()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('labels a pod by its members rather than as a versus pair', () => {
    // A four-name "A versus B versus C versus D" chain reads badly aloud.
    renderRound({ tournament: POD_TOURNAMENT })

    expect(
      screen.getByRole('button', { name: 'Report the pod with A, B, C, D' }),
    ).toBeInTheDocument()
  })

  it('opens the who-won sheet for a pod', async () => {
    const user = userEvent.setup()
    renderRound({ tournament: POD_TOURNAMENT })

    await user.click(screen.getByRole('button', { name: 'Report the pod with A, B, C, D' }))

    const sheet = screen.getByRole('dialog', { name: 'Report result' })
    expect(sheet).toBeVisible()
    expect(sheet.querySelector('button')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'C won' })).toBeInTheDocument()
  })

  it('shows the winner rather than a scoreline once a pod is reported', () => {
    const reported = makeTournament({
      eventFormat: 'commander',
      format: 'bo1',
      entrants: makeEntrants(3),
      rounds: [round(1, [pod(['entrant-1', 'entrant-2', 'entrant-3'], podResult(3, 1))])],
    })
    renderRound({ tournament: reported })

    // gameWins [0,1,0] -> B is the sole maximum.
    expect(screen.getByText('0-1-0')).toBeInTheDocument()
  })
})
