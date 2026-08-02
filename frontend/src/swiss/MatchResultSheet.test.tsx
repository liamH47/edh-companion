import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { match, pod, result } from '../core/swiss/fixtures'
import { MatchResultSheet } from './MatchResultSheet'

function renderSheet(overrides: Partial<Parameters<typeof MatchResultSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    match: match('entrant-1', 'entrant-2', null),
    format: 'bo3' as const,
    names: ['Ava', 'Ben'],
    onReport: vi.fn(),
    ...overrides,
  }
  render(<MatchResultSheet {...props} />)
  return props
}

describe('MatchResultSheet', () => {
  it('renders nothing without a match', () => {
    render(
      <MatchResultSheet
        open
        onClose={() => {}}
        match={null}
        format="bo3"
        names={[]}
        onReport={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names both sides, A first, since scorelines are written from A', () => {
    renderSheet()
    expect(screen.getByText('Ava vs Ben')).toBeInTheDocument()
  })

  it('offers every best-of-three scoreline', () => {
    renderSheet()
    for (const label of ['2-0', '2-1', '1-1 draw', '1-2', '0-2']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('offers win/draw/loss for best-of-one', () => {
    renderSheet({ format: 'bo1' })
    expect(screen.getByRole('button', { name: '1-0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '0-1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2-0' })).not.toBeInTheDocument()
  })

  it('reports the chosen scoreline and closes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: '2-1' }))
    expect(props.onReport).toHaveBeenCalledWith({ gameWins: [2, 1], gameDraws: 0 })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('marks the already-reported scoreline as selected', () => {
    renderSheet({ match: match('entrant-1', 'entrant-2', result(2, 0)) })
    expect(screen.getByRole('button', { name: '2-0' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2-1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers to clear an existing result', async () => {
    const user = userEvent.setup()
    const props = renderSheet({ match: match('entrant-1', 'entrant-2', result(2, 0)) })
    await user.click(screen.getByRole('button', { name: 'Clear result' }))
    expect(props.onReport).toHaveBeenCalledWith(null)
  })

  it('does not offer to clear a result that was never reported', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: 'Clear result' })).not.toBeInTheDocument()
  })

  it('offers re-pairing only when later rounds depend on this result', async () => {
    const user = userEvent.setup()
    const onRepair = vi.fn()
    const props = renderSheet({ onRepair })
    expect(screen.getByText(/Standings update either way/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Re-pair later rounds' }))
    expect(onRepair).toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('hides the re-pair option when nothing later depends on it', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: 'Re-pair later rounds' })).not.toBeInTheDocument()
  })
})

describe('MatchResultSheet for a Commander pod', () => {
  const POD = ['Ava', 'Ben', 'Cara', 'Dan']

  function renderPod(overrides: Partial<Parameters<typeof MatchResultSheet>[0]> = {}) {
    const props = {
      open: true,
      onClose: vi.fn(),
      match: pod(['entrant-1', 'entrant-2', 'entrant-3', 'entrant-4'], null),
      format: 'bo1' as const,
      names: POD,
      onReport: vi.fn(),
      ...overrides,
    }
    render(<MatchResultSheet {...props} />)
    return props
  }

  it('asks who won rather than offering a scoreline', () => {
    // Listing every game-win permutation for four players would be absurd; a pod is
    // one game with one survivor.
    renderPod()

    for (const name of POD) {
      expect(screen.getByRole('button', { name: `${name} won` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: '2-0' })).not.toBeInTheDocument()
  })

  it('names everyone at the table', () => {
    renderPod()
    expect(screen.getByText('Ava vs Ben vs Cara vs Dan')).toBeInTheDocument()
  })

  it('reports a win as one game win for that seat and none for the rest', () => {
    const props = renderPod()
    fireEvent.click(screen.getByRole('button', { name: 'Cara won' }))

    expect(props.onReport).toHaveBeenCalledWith({ gameWins: [0, 0, 1, 0], gameDraws: 0 })
  })

  it('offers a draw, because pods do run out of time', () => {
    const props = renderPod()
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))

    expect(props.onReport).toHaveBeenCalledWith({ gameWins: [0, 0, 0, 0], gameDraws: 1 })
  })

  it('marks the reported winner as selected', () => {
    renderPod({
      match: pod(
        ['entrant-1', 'entrant-2', 'entrant-3', 'entrant-4'],
        { gameWins: [0, 1, 0, 0], gameDraws: 0 },
      ),
    })
    expect(screen.getByRole('button', { name: 'Ben won' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Ava won' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('sizes the result to a three-player pod', () => {
    // The gameWins array has to match the pod, not assume four.
    const props = renderPod({
      match: pod(['entrant-1', 'entrant-2', 'entrant-3'], null),
      names: ['Ava', 'Ben', 'Cara'],
    })
    expect(screen.queryByRole('button', { name: 'Dan won' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cara won' }))
    expect(props.onReport).toHaveBeenCalledWith({ gameWins: [0, 0, 1], gameDraws: 0 })
  })
})
