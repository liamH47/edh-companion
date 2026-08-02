import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TournamentSetupScreen } from './TournamentSetupScreen'

async function fillPlayers(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (let i = 0; i < names.length; i++) {
    await user.type(screen.getByRole('textbox', { name: `Player ${i + 1}` }), names[i])
  }
}

describe('TournamentSetupScreen', () => {
  it('starts with four player rows and a 3-round default', () => {
    render(<TournamentSetupScreen onStart={() => {}} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
    expect(screen.getByRole('spinbutton', { name: 'Rounds' })).toHaveValue(3)
  })

  it('cannot start until at least two entrants are named', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    expect(screen.getByRole('button', { name: 'Start with this seating' })).toBeDisabled()
    await fillPlayers(user, ['Ava', 'Ben'])
    expect(screen.getByRole('button', { name: 'Start with this seating' })).toBeEnabled()
  })

  it('passes only the named entrants, in seat order', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben', 'Cara'])
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'solo',
        format: 'bo3',
        totalRounds: 3,
        entrantMembers: [['Ava'], ['Ben'], ['Cara']],
      }),
      false,
    )
  })

  it('flags random seating when started that way', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Start with random pairings' }))
    expect(onStart).toHaveBeenCalledWith(expect.anything(), true)
  })

  it('adds and removes player rows', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Add player/ }))
    expect(screen.getAllByRole('textbox')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'Remove Player 5' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('will not let the field shrink below two entrants', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Remove Player 4' }))
    await user.click(screen.getByRole('button', { name: 'Remove Player 3' }))
    expect(screen.getByRole('button', { name: 'Remove Player 2' })).toBeDisabled()
  })

  it('moves an entrant up the seating', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Move Player 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].entrantMembers).toEqual([['Ben'], ['Ava']])
  })

  it('moves an entrant down the seating', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Move Player 1 down' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].entrantMembers).toEqual([['Ben'], ['Ava']])
  })

  it('cannot move the first entrant up or the last down', () => {
    render(<TournamentSetupScreen onStart={() => {}} />)
    expect(screen.getByRole('button', { name: 'Move Player 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Player 4 down' })).toBeDisabled()
  })

  it('keeps every entrant when seats are randomized', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben', 'Cara', 'Dev'])
    await user.click(screen.getByRole('button', { name: 'Randomize seats' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    const flattened = onStart.mock.calls[0][0].entrantMembers.flat().sort()
    expect(flattened).toEqual(['Ava', 'Ben', 'Cara', 'Dev'])
  })

  it('asks for two names per team in Two-Headed Giant', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Two-Headed Giant' }))
    expect(screen.getByRole('textbox', { name: 'Team 1 player 1' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Team 1 player 2' })).toBeInTheDocument()
  })

  it('forces best-of-one for Two-Headed Giant and says why', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Two-Headed Giant' }))
    expect(screen.getByText('Two-Headed Giant is always best of 1.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Best of 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Best of 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('submits both names of each team', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await user.click(screen.getByRole('button', { name: 'Two-Headed Giant' }))
    await user.type(screen.getByRole('textbox', { name: 'Team 1 player 1' }), 'Ava')
    await user.type(screen.getByRole('textbox', { name: 'Team 1 player 2' }), 'Ben')
    await user.type(screen.getByRole('textbox', { name: 'Team 2 player 1' }), 'Cara')
    await user.type(screen.getByRole('textbox', { name: 'Team 2 player 2' }), 'Dev')
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        mode: 'two-headed-giant',
        format: 'bo1',
        entrantMembers: [
          ['Ava', 'Ben'],
          ['Cara', 'Dev'],
        ],
      }),
    )
  })

  it('adds a team with two name fields in Two-Headed Giant', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Two-Headed Giant' }))
    await user.click(screen.getByRole('button', { name: /Add team/ }))
    expect(screen.getByRole('textbox', { name: 'Team 5 player 1' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Team 5 player 2' })).toBeInTheDocument()
  })

  it('keeps the first name when switching back to singles', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: 'Player 1' }), 'Ava')
    await user.click(screen.getByRole('button', { name: 'Two-Headed Giant' }))
    await user.click(screen.getByRole('button', { name: 'Singles' }))
    expect(screen.getByRole('textbox', { name: 'Player 1' })).toHaveValue('Ava')
  })

  it('switches match length for a solo event', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Best of 1' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].format).toBe('bo1')
  })

  it('switches match length back to best of 3', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Best of 1' }))
    await user.click(screen.getByRole('button', { name: 'Best of 3' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].format).toBe('bo3')
  })

  it('recommends a round count once the field is known', async () => {
    const user = userEvent.setup()
    render(<TournamentSetupScreen onStart={() => {}} />)
    expect(screen.getByText('Add at least two entrants to start.')).toBeInTheDocument()
    await fillPlayers(user, ['Ava', 'Ben'])
    expect(screen.getByText('3 recommended for 2 players.')).toBeInTheDocument()
  })

  it('lets the round count be changed', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await fillPlayers(user, ['Ava', 'Ben'])
    await user.click(screen.getByRole('button', { name: 'Increase Rounds' }))
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].totalRounds).toBe(4)
  })

  it('trims whitespace from names', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TournamentSetupScreen onStart={onStart} />)
    await user.type(screen.getByRole('textbox', { name: 'Player 1' }), '  Ava  ')
    await user.type(screen.getByRole('textbox', { name: 'Player 2' }), 'Ben')
    await user.click(screen.getByRole('button', { name: 'Start with this seating' }))
    expect(onStart.mock.calls[0][0].entrantMembers).toEqual([['Ava'], ['Ben']])
  })
})
