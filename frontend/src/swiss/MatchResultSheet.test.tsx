import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { match, result } from '../core/swiss/fixtures'
import { MatchResultSheet } from './MatchResultSheet'

function renderSheet(overrides: Partial<Parameters<typeof MatchResultSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    match: match('entrant-1', 'entrant-2', null),
    format: 'bo3' as const,
    aName: 'Ava',
    bName: 'Ben',
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
        aName=""
        bName=""
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
    expect(props.onReport).toHaveBeenCalledWith({ aGameWins: 2, bGameWins: 1, gameDraws: 0 })
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
