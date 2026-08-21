import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPodSession, generateNextRound, savePodSession } from '@mtg/core/pods'
import { PodsScreen } from './PodsScreen'

afterEach(() => {
  localStorage.clear()
})

// Deterministic seating so tests never flake on a random shuffle.
const rng = () => 0

async function generate(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const [index, name] of names.entries()) {
    await user.type(screen.getByRole('textbox', { name: `Player ${index + 1}` }), name)
  }
  await user.click(screen.getByRole('button', { name: 'Generate pods' }))
}

describe('PodsScreen', () => {
  it('shows setup first, then the first round of pods', async () => {
    const user = userEvent.setup()
    render(<PodsScreen onBack={vi.fn()} rng={rng} />)

    expect(screen.getByRole('heading', { name: 'Commander pods' })).toBeInTheDocument()
    await generate(user, ['Ava', 'Ben', 'Cara', 'Dev'])

    expect(screen.getByRole('heading', { name: 'Round 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'R1' })).toBeInTheDocument()
  })

  it('adds a round and lets you flip back to an earlier one', async () => {
    const user = userEvent.setup()
    render(<PodsScreen onBack={vi.fn()} rng={rng} />)
    await generate(user, ['Ava', 'Ben', 'Cara', 'Dev'])

    await user.click(screen.getByRole('button', { name: 'New round' }))
    expect(screen.getByRole('heading', { name: 'Round 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'R1' }))
    expect(screen.getByRole('heading', { name: 'Round 1' })).toBeInTheDocument()
    // An earlier round is read-only.
    expect(screen.queryByRole('button', { name: 'New round' })).not.toBeInTheDocument()
  })

  it('reshuffles the current round without adding one', async () => {
    const user = userEvent.setup()
    render(<PodsScreen onBack={vi.fn()} rng={rng} />)
    await generate(user, ['Ava', 'Ben', 'Cara', 'Dev'])

    await user.click(screen.getByRole('button', { name: 'Reshuffle this round' }))
    expect(screen.getByRole('button', { name: 'R1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'R2' })).not.toBeInTheDocument()
  })

  it('starts over back to setup', async () => {
    const user = userEvent.setup()
    render(<PodsScreen onBack={vi.fn()} rng={rng} />)
    await generate(user, ['Ava', 'Ben', 'Cara', 'Dev'])

    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.getByRole('button', { name: 'Generate pods' })).toBeInTheDocument()
  })

  it('resumes a saved session and goes back to the chooser', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<PodsScreen onBack={onBack} rng={rng} />)
    await generate(user, ['Ava', 'Ben', 'Cara', 'Dev'])

    await user.click(screen.getByRole('button', { name: '‹ Pairings' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('resumes on the latest round, not round 1', () => {
    // A refresh mid-night reloads the session from storage; the current seating is
    // the only round anyone is looking for.
    savePodSession(
      generateNextRound(generateNextRound(createPodSession(['Ava', 'Ben', 'Cara', 'Dev']), rng), rng),
    )
    render(<PodsScreen onBack={vi.fn()} rng={rng} />)
    expect(screen.getByRole('heading', { name: 'Round 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'R2' })).toHaveAttribute('aria-current', 'page')
  })
})
