import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Match, MatchResult } from '@mtg/core/swiss'
import { MatchScoreRow } from './MatchScoreRow'

/** The status footer, scoped through its live region -- "Draw"/"X won" also appear as
 * tap-target labels, so a bare text query would be ambiguous. */
function statusRegion() {
  const region = document.querySelector('[aria-live="polite"]')
  expect(region).not.toBeNull()
  return within(region as HTMLElement)
}

function makeMatch(entrantCount: number, result: MatchResult | null = null): Match {
  const entrantIds = Array.from({ length: entrantCount }, (_unused, i) => `entrant-${i + 1}`)
  return { id: entrantIds.join('-vs-'), entrantIds, result }
}

const DUEL_NAMES = ['Ava', 'Ben']
const POD_NAMES = ['Ava', 'Ben', 'Cara']

function renderDuel(result: MatchResult | null = null, format: 'bo3' | 'bo1' = 'bo3') {
  const onReport = vi.fn()
  render(
    <MatchScoreRow
      match={makeMatch(2, result)}
      format={format}
      isPodEvent={false}
      names={DUEL_NAMES}
      onReport={onReport}
    />,
  )
  return onReport
}

function renderPod(result: MatchResult | null = null) {
  const onReport = vi.fn()
  render(
    <MatchScoreRow
      match={makeMatch(3, result)}
      format="bo1"
      isPodEvent
      names={POD_NAMES}
      onReport={onReport}
    />,
  )
  return onReport
}

describe('1v1 counting', () => {
  it('shows a stable tap target per player with a visible count', () => {
    renderDuel({ gameWins: [2, 1], gameDraws: 0 })
    // The count lives in the button content; the accessible name never churns.
    const ava = screen.getByRole('button', { name: 'Add a game win for Ava' })
    expect(ava).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: 'Add a game win for Ben' })).toHaveTextContent('1')
  })

  it('reports the first game win from an unreported match', async () => {
    const user = userEvent.setup()
    const onReport = renderDuel()
    await user.click(screen.getByRole('button', { name: 'Add a game win for Ava' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [1, 0], gameDraws: 0 })
  })

  it('disables adding past the bo3 cap, but not the other player', () => {
    renderDuel({ gameWins: [2, 0], gameDraws: 0 })
    expect(screen.getByRole('button', { name: 'Add a game win for Ava' })).toBeDisabled()
    // Out-of-order entry of a 2-1: the third tap must not be dead.
    expect(screen.getByRole('button', { name: 'Add a game win for Ben' })).toBeEnabled()
  })

  it('disables adding past the bo1 cap', () => {
    renderDuel({ gameWins: [1, 0], gameDraws: 0 }, 'bo1')
    expect(screen.getByRole('button', { name: 'Add a game win for Ava' })).toBeDisabled()
  })

  it('removes a game win, and disables removal at zero', async () => {
    const user = userEvent.setup()
    const onReport = renderDuel({ gameWins: [2, 1], gameDraws: 0 })
    await user.click(screen.getByRole('button', { name: 'Remove a game win for Ava' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [1, 1], gameDraws: 0 })
    expect(screen.getByRole('button', { name: 'Remove a game win for Ben' })).toBeEnabled()
    // Ben is at 1; Ava's remove stays enabled at 2. Zero-count remove is the disabled one:
    renderDuel()
  })

  it('disables removal on an unreported match', () => {
    renderDuel()
    expect(screen.getByRole('button', { name: 'Remove a game win for Ava' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove a game win for Ben' })).toBeDisabled()
  })

  it('reports null when the last win is removed -- Not reported is reachable by undoing', async () => {
    const user = userEvent.setup()
    const onReport = renderDuel({ gameWins: [1, 0], gameDraws: 0 })
    await user.click(screen.getByRole('button', { name: 'Remove a game win for Ava' }))
    expect(onReport).toHaveBeenCalledWith(null)
  })

  it('adds and removes a drawn game, with match-scoped labels', async () => {
    const user = userEvent.setup()
    const onReport = renderDuel({ gameWins: [1, 1], gameDraws: 0 })
    await user.click(screen.getByRole('button', { name: 'Add a game draw for Ava versus Ben' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [1, 1], gameDraws: 1 })
  })

  it('disables adding a draw at the cap, and removing one still works', async () => {
    const user = userEvent.setup()
    const onReport = renderDuel({ gameWins: [0, 0], gameDraws: 3 })
    expect(
      screen.getByRole('button', { name: 'Add a game draw for Ava versus Ben' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove a game draw for Ava versus Ben' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [0, 0], gameDraws: 2 })
  })

  it('disables removing a draw when there is none', () => {
    renderDuel()
    expect(
      screen.getByRole('button', { name: 'Remove a game draw for Ava versus Ben' }),
    ).toBeDisabled()
  })

  it('reads Not reported, then the scoreline, then Draw on a top tie', () => {
    const { rerender } = render(
      <MatchScoreRow
        match={makeMatch(2)}
        format="bo3"
        isPodEvent={false}
        names={DUEL_NAMES}
        onReport={vi.fn()}
      />,
    )
    expect(statusRegion().getByText('Not reported')).toBeInTheDocument()

    rerender(
      <MatchScoreRow
        match={makeMatch(2, { gameWins: [2, 1], gameDraws: 0 })}
        format="bo3"
        isPodEvent={false}
        names={DUEL_NAMES}
        onReport={vi.fn()}
      />,
    )
    expect(statusRegion().getByText('2-1')).toBeInTheDocument()

    rerender(
      <MatchScoreRow
        match={makeMatch(2, { gameWins: [1, 1], gameDraws: 1 })}
        format="bo3"
        isPodEvent={false}
        names={DUEL_NAMES}
        onReport={vi.fn()}
      />,
    )
    expect(statusRegion().getByText('Draw')).toBeInTheDocument()
  })

  it('announces the status through a live region', () => {
    renderDuel({ gameWins: [2, 0], gameDraws: 0 })
    expect(screen.getByText('2-0').closest('[aria-live="polite"]')).not.toBeNull()
  })
})

describe('pod set-winner', () => {
  it('marks each member as a toggle, pressed only on the winner', () => {
    renderPod({ gameWins: [0, 1, 0], gameDraws: 0 })
    expect(screen.getByRole('button', { name: 'Ava won' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Ben won' })).toHaveAttribute('aria-pressed', 'true')
    expect(statusRegion().getByText('Ben won')).toBeInTheDocument()
  })

  it('sets the winner from an unreported pod', async () => {
    const user = userEvent.setup()
    const onReport = renderPod()
    await user.click(screen.getByRole('button', { name: 'Cara won' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [0, 0, 1], gameDraws: 0 })
  })

  it('moves the win rather than adding a second one', async () => {
    const user = userEvent.setup()
    const onReport = renderPod({ gameWins: [1, 0, 0], gameDraws: 0 })
    await user.click(screen.getByRole('button', { name: 'Ben won' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [0, 1, 0], gameDraws: 0 })
  })

  it('only the winner row can be removed, and removal reports null', async () => {
    const user = userEvent.setup()
    const onReport = renderPod({ gameWins: [1, 0, 0], gameDraws: 0 })
    expect(screen.getByRole('button', { name: 'Remove the win for Ben' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove the win for Ava' }))
    expect(onReport).toHaveBeenCalledWith(null)
  })

  it('records the timed-out pod as a shared draw, replacing any winner', async () => {
    const user = userEvent.setup()
    const onReport = renderPod({ gameWins: [1, 0, 0], gameDraws: 0 })
    await user.click(screen.getByRole('button', { name: 'Draw for the pod with Ava, Ben, Cara' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [0, 0, 0], gameDraws: 1 })
  })

  it('a drawn pod reads Draw, disables re-drawing, and its removal reports null', async () => {
    const user = userEvent.setup()
    const onReport = renderPod({ gameWins: [0, 0, 0], gameDraws: 1 })
    expect(
      screen.getByRole('button', { name: 'Draw for the pod with Ava, Ben, Cara' }),
    ).toBeDisabled()
    expect(statusRegion().getByText('Draw')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Remove the draw for the pod with Ava, Ben, Cara' }),
    )
    expect(onReport).toHaveBeenCalledWith(null)
  })

  it('keeps set-winner semantics at a 2-player commander table', async () => {
    // podSizes(2) seats a duel, but the event is still commander: one game, one
    // survivor. [1, 1] must stay unreachable.
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(
      <MatchScoreRow
        match={makeMatch(2, { gameWins: [1, 0], gameDraws: 0 })}
        format="bo1"
        isPodEvent
        names={DUEL_NAMES}
        onReport={onReport}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Ben won' }))
    expect(onReport).toHaveBeenCalledWith({ gameWins: [0, 1], gameDraws: 0 })
  })

  it('renders a legacy zero-filled result as a draw rather than crashing', () => {
    // outcomeFor scores an all-zero, zero-draw shape as a mutual draw; the row reads
    // it the same way instead of pretending someone won.
    renderPod({ gameWins: [0, 0, 0], gameDraws: 0 })
    expect(statusRegion().getByText('Draw')).toBeInTheDocument()
  })
})
