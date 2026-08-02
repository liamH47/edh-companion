import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

/** A real controlled input snaps back to its old value on every keystroke unless the
 * value prop actually updates, which breaks userEvent.type's character-by-character
 * typing. This harness makes Stepper controlled by real state while still reporting
 * every onChange call to the spy, so tests can assert on the full change sequence. */
function ControlledStepper({
  initial,
  onChange,
  ...rest
}: {
  initial: number
  onChange: (value: number) => void
} & Omit<Parameters<typeof Stepper>[0], 'value' | 'onChange'>) {
  const [value, setValue] = useState(initial)
  return (
    <Stepper
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('Stepper', () => {
  it('renders the current value in a labeled group', () => {
    render(<Stepper value={4} onChange={() => {}} label="Spells cast" />)
    expect(screen.getByRole('group', { name: 'Spells cast' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Spells cast' })).toHaveValue(4)
  })

  it('increments by the default step of 1', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} label="Spells cast" />)
    await user.click(screen.getByRole('button', { name: 'Increase Spells cast' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('decrements by a custom step', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={10} onChange={onChange} label="Life" step={5} />)
    await user.click(screen.getByRole('button', { name: 'Decrease Life' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('disables and clamps the decrement button at min', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={0} onChange={onChange} label="Life" min={0} />)
    const decrement = screen.getByRole('button', { name: 'Decrease Life' })
    expect(decrement).toBeDisabled()
    await user.click(decrement)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables and clamps the increment button at max', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={99} onChange={onChange} label="Spells" max={99} />)
    const increment = screen.getByRole('button', { name: 'Increase Spells' })
    expect(increment).toBeDisabled()
    await user.click(increment)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not disable buttons when min/max are unset, and clamps nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={0} onChange={onChange} label="Unbounded" />)
    const decrement = screen.getByRole('button', { name: 'Decrease Unbounded' })
    const increment = screen.getByRole('button', { name: 'Increase Unbounded' })
    expect(decrement).toBeEnabled()
    expect(increment).toBeEnabled()
    await user.click(decrement)
    expect(onChange).toHaveBeenLastCalledWith(-1)
    await user.click(increment)
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('clamps a decrement to min without clamping to a max that is unset', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={5} onChange={onChange} label="Life" min={0} />)
    await user.click(screen.getByRole('button', { name: 'Decrease Life' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clamps an increment to max without clamping to a min that is unset', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={5} onChange={onChange} label="Spells" max={99} />)
    await user.click(screen.getByRole('button', { name: 'Increase Spells' }))
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('reports a directly typed value, clamped and truncated to an integer', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ControlledStepper initial={0} onChange={onChange} label="Starting life" max={99999} />,
    )
    const input = screen.getByRole('spinbutton', { name: 'Starting life' })
    await user.clear(input)
    await user.type(input, '150000')
    expect(onChange).toHaveBeenLastCalledWith(99999)
  })

  it('ignores an empty input rather than calling onChange with NaN', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper value={5} onChange={onChange} label="Life" />)
    const input = screen.getByRole('spinbutton', { name: 'Life' })
    await user.clear(input)
    expect(onChange).not.toHaveBeenCalled()
  })
})
