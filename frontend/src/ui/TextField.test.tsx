import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('renders a visible label wired to the input', () => {
    render(<TextField value="" onChange={() => {}} label="Player name" />)
    expect(screen.getByText('Player name')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Player name' })).toBeInTheDocument()
  })

  it('reports each keystroke through onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextField value="" onChange={onChange} label="Player name" />)
    await user.type(screen.getByRole('textbox', { name: 'Player name' }), 'A')
    expect(onChange).toHaveBeenCalledWith('A')
  })

  it('shows the current value', () => {
    render(<TextField value="Liam" onChange={() => {}} label="Player name" />)
    expect(screen.getByRole('textbox', { name: 'Player name' })).toHaveValue('Liam')
  })

  it('keeps the label accessible but hides it visually when hideLabel is set', () => {
    render(<TextField value="" onChange={() => {}} label="Search cards" hideLabel />)
    expect(screen.queryByText('Search cards')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search cards' })).toBeInTheDocument()
  })

  it('renders a placeholder', () => {
    render(<TextField value="" onChange={() => {}} label="Name" placeholder="e.g. Liam" />)
    expect(screen.getByPlaceholderText('e.g. Liam')).toBeInTheDocument()
  })

  it('renders a search-type input when asked', () => {
    render(<TextField value="" onChange={() => {}} label="Search" type="search" hideLabel />)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('renders leading content inside the field', () => {
    render(
      <TextField value="" onChange={() => {}} label="Search" leading={<span>icon</span>} />,
    )
    expect(screen.getByText('icon')).toBeInTheDocument()
  })

  it('merges a caller-supplied className', () => {
    const { container } = render(
      <TextField value="" onChange={() => {}} label="Name" className="extra" />,
    )
    expect(container.querySelector('label')).toHaveClass('extra')
  })
})
