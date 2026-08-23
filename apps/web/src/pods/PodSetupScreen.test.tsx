import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PodSetupScreen } from './PodSetupScreen'

function renderSetup() {
  const onStart = vi.fn()
  const onBack = vi.fn()
  render(<PodSetupScreen onStart={onStart} onBack={onBack} />)
  return { onStart, onBack }
}

async function typeNames(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const [index, name] of names.entries()) {
    await user.type(screen.getByRole('textbox', { name: `Player ${index + 1}` }), name)
  }
}

describe('PodSetupScreen', () => {
  it('cannot generate pods until enough players are named', async () => {
    const user = userEvent.setup()
    renderSetup()

    expect(screen.getByRole('button', { name: 'Generate pods' })).toBeDisabled()
    expect(screen.getByText('Add at least 3 players to make pods.')).toBeInTheDocument()

    await typeNames(user, ['Ava', 'Ben'])
    expect(screen.getByRole('button', { name: 'Generate pods' })).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Player 3' }), 'Cara')
    expect(screen.getByRole('button', { name: 'Generate pods' })).toBeEnabled()
    expect(screen.getByText('3 players — one pod of 3.')).toBeInTheDocument()
  })

  it('starts with the trimmed, non-empty names', async () => {
    const user = userEvent.setup()
    const { onStart } = renderSetup()

    await typeNames(user, ['  Ava  ', 'Ben', 'Cara'])
    await user.click(screen.getByRole('button', { name: 'Generate pods' }))

    expect(onStart).toHaveBeenCalledWith(['Ava', 'Ben', 'Cara'])
  })

  it('adds players and describes the resulting pods', async () => {
    const user = userEvent.setup()
    renderSetup()

    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await typeNames(user, ['Ava', 'Ben', 'Cara', 'Dev', 'Eve', 'Fin'])

    expect(screen.getByText('6 players — 2 pods: 3 and 3.')).toBeInTheDocument()
  })

  it('removes a player, and stops at the three-player floor', async () => {
    const user = userEvent.setup()
    renderSetup()

    // Four rows to start: removing one is allowed, the fourth removal is not.
    await user.click(screen.getByRole('button', { name: 'Remove player 4' }))
    expect(screen.queryByRole('textbox', { name: 'Player 4' })).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Remove player 1' })).toBeDisabled()
  })

  it('goes back to the chooser', async () => {
    const user = userEvent.setup()
    const { onBack } = renderSetup()

    await user.click(screen.getByRole('button', { name: 'Pairings' }))
    expect(onBack).toHaveBeenCalled()
  })
})
