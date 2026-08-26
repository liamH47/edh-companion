import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmSheet } from './ConfirmSheet'

function renderSheet(overrides: Partial<Parameters<typeof ConfirmSheet>[0]> = {}) {
  const props = {
    open: true,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Reset it?',
    message: 'Everything goes back to defaults.',
    confirmLabel: 'Reset it',
    ...overrides,
  }
  render(<ConfirmSheet {...props} />)
  return props
}

describe('ConfirmSheet', () => {
  it('renders nothing while closed', () => {
    renderSheet({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the question, what it costs, and both ways out', () => {
    renderSheet()
    expect(screen.getByRole('dialog', { name: 'Reset it?' })).toBeInTheDocument()
    expect(screen.getByText('Everything goes back to defaults.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset it' })).toBeInTheDocument()
  })

  it('confirms only when the labelled confirm button is pressed', async () => {
    const user = userEvent.setup()
    const props = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Reset it' }))
    expect(props.onConfirm).toHaveBeenCalledOnce()
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('cancels without confirming', async () => {
    const user = userEvent.setup()
    const props = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('treats every Sheet dismissal path as a cancel, never a confirm', async () => {
    // Backdrop, Esc and the close button all funnel through Sheet's onClose. Wiring
    // that to onConfirm would make a stray tap outside the sheet destroy the session --
    // the exact thing this component exists to prevent.
    const user = userEvent.setup()
    const props = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onCancel).toHaveBeenCalledOnce()

    await user.keyboard('{Escape}')
    expect(props.onCancel).toHaveBeenCalledTimes(2)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
})
