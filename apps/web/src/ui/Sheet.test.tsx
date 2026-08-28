import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Board state">
        content
      </Sheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the title and children when open', () => {
    render(
      <Sheet open onClose={() => {}} title="Board state">
        <p>child content</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Board state' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('keeps the header out of the scroll region so the way out never scrolls away', () => {
    // On a short viewport (a landscape phone) a tall sheet used to grow off the TOP of
    // the screen -- panel top at -38px with the Close button at y=-1, unreachable, and
    // nothing scrolling to bring it back. The panel is now a shrinkable flex item whose
    // body scrolls; the handle and header are shrink-0 above that body.
    render(
      <Sheet open onClose={() => {}} title="Board state">
        <p>child content</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Board state' })
    expect(dialog).toHaveClass('min-h-0')

    const close = screen.getByRole('button', { name: 'Close' })
    const body = screen.getByText('child content').parentElement
    expect(body).toHaveClass('overflow-y-auto')
    // The scrolling body holds the children and not the close button.
    expect(body).not.toContainElement(close)
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Board state">
        content
      </Sheet>,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <Sheet open onClose={onClose} title="Board state">
        content
      </Sheet>,
    )
    const backdrop = container.querySelector('.bg-overlay')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as Element)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Board state">
        content
      </Sheet>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores keys other than Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Board state">
        content
      </Sheet>,
    )
    await user.keyboard('{Enter}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not react to Escape while closed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open={false} onClose={onClose} title="Board state">
        content
      </Sheet>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus to the panel on open and restores it on close', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button onClick={() => setOpen(true)}>open sheet</button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Board state">
            content
          </Sheet>
        </div>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'open sheet' })
    trigger.focus()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    render(
      <Sheet open onClose={() => {}} title="Board state">
        <button>child button</button>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog')
    const childButton = screen.getByRole('button', { name: 'child button' })
    dialog.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(childButton).toHaveFocus()
  })

  it('wraps Tab from the last focusable element back to the panel', () => {
    render(
      <Sheet open onClose={() => {}} title="Board state">
        <button>child button</button>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog')
    const childButton = screen.getByRole('button', { name: 'child button' })
    childButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog).toHaveFocus()
  })

  it('does not intercept Tab away from a trap boundary', () => {
    render(
      <Sheet open onClose={() => {}} title="Board state">
        <button>child button</button>
      </Sheet>,
    )
    screen.getByRole('button', { name: 'Close' }).focus()
    const notPrevented = fireEvent.keyDown(document, { key: 'Tab' })
    expect(notPrevented).toBe(true)
  })
})
