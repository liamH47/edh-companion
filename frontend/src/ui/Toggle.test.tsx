import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('renders default Yes/No labels in a labeled group', () => {
    render(<Toggle value={true} onChange={() => {}} label="In play?" />)
    expect(screen.getByRole('group', { name: 'In play?' })).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('marks the true segment pressed when value is true', () => {
    render(<Toggle value={true} onChange={() => {}} label="In play?" />)
    expect(screen.getByText('Yes').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('No').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks the false segment pressed when value is false', () => {
    render(<Toggle value={false} onChange={() => {}} label="In play?" />)
    expect(screen.getByText('Yes').closest('button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('No').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange(true) when the true segment is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle value={false} onChange={onChange} label="In play?" />)
    await user.click(screen.getByText('Yes'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange(false) when the false segment is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle value={true} onChange={onChange} label="In play?" />)
    await user.click(screen.getByText('No'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('accepts custom segment labels', () => {
    render(
      <Toggle
        value={true}
        onChange={() => {}}
        label="Mode"
        trueLabel="On"
        falseLabel="Off"
      />,
    )
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByText('Off')).toBeInTheDocument()
  })
})
