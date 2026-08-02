import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SoundToggle } from './SoundToggle'

describe('SoundToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts enabled (sound on) by default', () => {
    render(<SoundToggle />)
    expect(screen.getByRole('button', { name: 'Mute coin flip sound' })).toBeInTheDocument()
  })

  it('toggles to muted and back on click, persisting the choice', async () => {
    const user = userEvent.setup()
    render(<SoundToggle />)

    await user.click(screen.getByRole('button', { name: 'Mute coin flip sound' }))
    expect(screen.getByRole('button', { name: 'Unmute coin flip sound' })).toBeInTheDocument()
    expect(localStorage.getItem('mtg-calc-sound-enabled')).toBe('off')

    await user.click(screen.getByRole('button', { name: 'Unmute coin flip sound' }))
    expect(screen.getByRole('button', { name: 'Mute coin flip sound' })).toBeInTheDocument()
    expect(localStorage.getItem('mtg-calc-sound-enabled')).toBe('on')
  })

  it('starts muted when a disabled preference is already stored', () => {
    localStorage.setItem('mtg-calc-sound-enabled', 'off')
    render(<SoundToggle />)
    expect(screen.getByRole('button', { name: 'Unmute coin flip sound' })).toBeInTheDocument()
  })
})
