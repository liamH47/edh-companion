import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardMetadata, FieldSpec, OutputSpec } from '@mtg/core'

/** Registered as the compute backend below, so these exercise the real hook
 * against a stand-in for the server rather than a mocked module. */
const compute = vi.fn()
import { setComputeBackend } from '@mtg/core'
import { CardScreen } from './CardScreen'


function field(overrides: Partial<FieldSpec> & Pick<FieldSpec, 'name' | 'kind'>): FieldSpec {
  return {
    label: overrides.name,
    default: null,
    min: null,
    max: null,
    options: null,
    visible_if: null,
    help_text: null,
    default_source: null,
    action_label: null,
    action_disabled_when: null,
    roll: null,
    map: null,
    picker: null,
    mana: null,
    persists_across_turns: false,
    new_turn_carries_output: null,
    setup: false,
    short_label: null,
    ...overrides,
  }
}

function output(overrides: Partial<OutputSpec> & Pick<OutputSpec, 'name'>): OutputSpec {
  return {
    label: overrides.name,
    kind: 'number',
    short_label: null,
    primary: false,
    hero_shape: 'number',
    hidden: false,
    ...overrides,
  }
}

const aetherfluxLikeCard: CardMetadata = {
  id: 'aetherflux-reservoir',
  name: 'Aetherflux Reservoir',
  rules_text: 'Whenever you cast a spell, you gain 1 life for each spell cast this turn.',
  scryfall_id: '96b6b2e1-c3e6-464c-8a13-b15deb34e862',
  show_hero_art: false,
    resets_on_new_turn: true,
  fields: [
    field({
      name: 'starting_life',
      kind: 'number',
      label: 'Life total at the start of the turn',
      short_label: 'start life',
      default: 40,
      min: 0,
      max: 99999,
      setup: true,
    }),
    field({
      name: 'was_in_play_at_turn_start',
      kind: 'boolean',
      label: 'In play at the start of the turn?',
      short_label: 'in play',
      default: true,
      setup: true,
    }),
    field({
      name: 'spells_cast_this_turn',
      kind: 'counter',
      label: 'Spells cast this turn',
      default: 0,
      min: 0,
      max: 99,
    }),
    field({
      name: 'activations_used',
      kind: 'counter',
      label: 'Activations used',
      default: 0,
      min: 0,
      max: 99,
      action_label: 'Pay 50 Life',
      action_disabled_when: { output: 'current_life', less_than: 50 },
    }),
  ],
  outputs: [
    output({ name: 'damage_available', label: 'Damage available', short_label: 'damage', primary: true }),
    output({ name: 'current_life', label: 'Current life total', short_label: 'life' }),
  ],
  alert: { output: 'game_lost', message: 'Oops, looks like you lose now', tone: 'danger' },
}

const allSetupCard: CardMetadata = {
  id: 'all-setup',
  name: 'All Setup Card',
  rules_text: '...',
  scryfall_id: null,
  show_hero_art: false,
    resets_on_new_turn: true,
  fields: [field({ name: 'power', kind: 'number', label: 'Power', setup: true })],
  outputs: [output({ name: 'total', label: 'Total', primary: true })],
  alert: null,
}

const singleOutputCard: CardMetadata = {
  id: 'single-output',
  name: 'Single Output Card',
  rules_text: '...',
  scryfall_id: null,
  show_hero_art: false,
    resets_on_new_turn: true,
  fields: [field({ name: 'creatures_died', kind: 'number', label: 'Creatures died' })],
  outputs: [output({ name: 'total_life_drained', label: 'Total life drained', primary: true })],
  alert: null,
}

beforeEach(() => {
  compute.mockReset()
  setComputeBackend(compute)
  compute.mockReturnValue({ damage_available: 50, current_life: 90 })
})

describe('CardScreen', () => {
  it('auto-opens the setup sheet on first visit when setup fields exist and are unconfirmed', async () => {
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(await screen.findByRole('dialog', { name: 'Board state' })).toBeInTheDocument()
  })

  it('shows the summary bar once setup is confirmed via Done, and no longer the sheet', async () => {
    const user = userEvent.setup()
    render(<CardScreen card={aetherfluxLikeCard} />)
    await screen.findByRole('dialog', { name: 'Board state' })

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('40 start life')).toBeInTheDocument()
    expect(screen.getByText('in play ✓')).toBeInTheDocument()
  })

  it('renders the primary output as the hero and the rest in the stat strip', async () => {
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(await screen.findByText('damage')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('50')).toBeInTheDocument())
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('life')).toBeInTheDocument()
  })

  it('renders live fields and reports changes through the session', async () => {
    const user = userEvent.setup()
    render(<CardScreen card={aetherfluxLikeCard} />)
    await screen.findByRole('dialog', { name: 'Board state' })
    await user.click(screen.getByRole('button', { name: 'Done' }))

    const spellsStepper = await screen.findByRole('spinbutton', { name: 'Spells cast this turn' })
    expect(spellsStepper).toHaveValue(0)
    await user.click(screen.getByRole('button', { name: 'Increase Spells cast this turn' }))
    expect(spellsStepper).toHaveValue(1)
  })

  it('renders the action bar button for a live counter with action_label', async () => {
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(await screen.findByRole('button', { name: 'Pay 50 Life' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New turn' })).toBeInTheDocument()
  })

  it('shows the alert banner and a role=alert once the alert output is true', async () => {
    compute.mockReturnValue({ damage_available: 0, current_life: 0, game_lost: true })
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(await screen.findByText('Oops, looks like you lose now')).toBeInTheDocument()
  })

  it('shows an error banner when the input is rejected', async () => {
    compute.mockImplementation(() => {
      throw new Error('count must be >= 0')
    })
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(await screen.findByText('count must be >= 0')).toBeInTheDocument()
  })

  it('renders a back button and calls onBack when clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<CardScreen card={aetherfluxLikeCard} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders no back button when onBack is not given', () => {
    render(<CardScreen card={aetherfluxLikeCard} />)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('opens the card detail sheet from the header button, and closes it again', async () => {
    const user = userEvent.setup()
    render(<CardScreen card={aetherfluxLikeCard} />)
    await screen.findByRole('dialog', { name: 'Board state' })
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'View card' }))
    expect(screen.getByRole('img', { name: 'Aetherflux Reservoir, as printed' })).toBeInTheDocument()
    expect(
      screen.getByText('Whenever you cast a spell, you gain 1 life for each spell cast this turn.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reopens the sheet by tapping the summary bar after it has been confirmed', async () => {
    const user = userEvent.setup()
    render(<CardScreen card={aetherfluxLikeCard} />)
    await screen.findByRole('dialog', { name: 'Board state' })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Edit board state' }))
    expect(await screen.findByRole('dialog', { name: 'Board state' })).toBeInTheDocument()
  })

  it('renders an all-setup card inline with no summary bar or sheet', async () => {
    compute.mockReturnValue({ total: 0 })
    render(<CardScreen card={allSetupCard} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit board state' })).not.toBeInTheDocument()
    expect(await screen.findByRole('spinbutton', { name: 'Power' })).toBeInTheDocument()
  })

  it('renders only the hero for a single-output card, no stat strip', async () => {
    compute.mockReturnValue({ total_life_drained: 6 })
    render(<CardScreen card={singleOutputCard} />)
    expect(await screen.findByText('6')).toBeInTheDocument()
    // Only the hero's own render of "6" should exist -- no duplicate stat tile.
    expect(screen.getAllByText('6')).toHaveLength(1)
  })

  it('renders the card large with loyalty overlaid when the schema asks for both', async () => {
    compute.mockReturnValue({ loyalty: 7 })
    const cometLike: CardMetadata = {
      ...singleOutputCard,
      id: 'comet-like',
      scryfall_id: '96b6b2e1-c3e6-464c-8a13-b15deb34e862',
      show_hero_art: true,
      outputs: [output({ name: 'loyalty', primary: true, hero_shape: 'shield' })],
    }
    render(<CardScreen card={cometLike} />)
    // The card IS the hero: full-size art with the badge over its printed loyalty box.
    expect(await screen.findByTestId('card-art-hero')).toBeInTheDocument()
    fireEvent.load(screen.getByAltText('Single Output Card, as printed'))
    expect(screen.getByTestId('loyalty-shield')).toBeInTheDocument()
    expect(screen.getByAltText('Single Output Card, as printed')).toBeInTheDocument()
  })

  it('renders inline art beside the plain hero when only show_hero_art is set', async () => {
    compute.mockReturnValue({ total_life_drained: 4 })
    const artOnly: CardMetadata = {
      ...singleOutputCard,
      id: 'art-only',
      scryfall_id: '96b6b2e1-c3e6-464c-8a13-b15deb34e862',
      show_hero_art: true,
    }
    render(<CardScreen card={artOnly} />)
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.queryByTestId('loyalty-shield')).not.toBeInTheDocument()
    expect(screen.getByAltText('Single Output Card, as printed')).toBeInTheDocument()
  })

  it('renders the shield alone for a shield hero with no inline art', async () => {
    compute.mockReturnValue({ loyalty: 3 })
    const shieldNoArt: CardMetadata = {
      ...singleOutputCard,
      id: 'shield-no-art',
      outputs: [output({ name: 'loyalty', primary: true, hero_shape: 'shield' })],
    }
    render(<CardScreen card={shieldNoArt} />)
    expect(await screen.findByTestId('loyalty-shield')).toBeInTheDocument()
    expect(screen.queryByAltText(/as printed/)).not.toBeInTheDocument()
  })

  it('folds hero and strip into one compact row when a live field is mapped', async () => {
    compute.mockReturnValue({ completed: 1, rooms: 2 })
    const dungeonLike: CardMetadata = {
      ...singleOutputCard,
      id: 'dungeon-like',
      fields: [
        field({
          name: 'path',
          kind: 'sequence',
          label: 'Path',
          options: [
            { value: 'a', label: 'A', scryfall_id: null },
            { value: 'b', label: 'B', scryfall_id: null },
          ],
          map: {
            entry: 'a',
            scryfall_id: null,
            nodes: [
              { id: 'a', column: 0, row: 0, art: null },
              { id: 'b', column: 1, row: 0, art: null },
            ],
            edges: [{ source: 'a', target: 'b' }],
          },
        }),
      ],
      outputs: [
        output({ name: 'completed', primary: true }),
        output({ name: 'rooms', label: 'Rooms', short_label: 'rooms' }),
      ],
    }
    render(<CardScreen card={dungeonLike} />)
    // The compact hero row renders instead of the full-height centred column...
    expect(await screen.findByTestId('hero-compact')).toBeInTheDocument()
    // ...with the strip beside it, and the map still below as the main event.
    expect(screen.getByText('rooms')).toBeInTheDocument()
    expect(screen.getByTestId('dungeon-map-path')).toBeInTheDocument()
  })

  it('renders a list hero as effect rows above the fields, stats compressed', async () => {
    // Landfall's shape: the answer is everything that happens at once, so the hero is
    // a list and the supporting numbers compress into one row above it.
    compute.mockReturnValue({
      effects: [
        { source: 'Lotus Cobra', effect: 'Add one mana of any color', note: '2 mana' },
        { source: 'Tatyova, Benthic Druid', effect: 'Gain 1 life and draw a card', note: '2 cards · 2 life' },
      ],
      triggers: 4,
    })
    const landfallLike: CardMetadata = {
      ...singleOutputCard,
      id: 'landfall-like',
      scryfall_id: null,
      fields: [
        field({
          name: 'sources',
          kind: 'sequence',
          label: 'Permanents you control',
          default: [],
          options: [{ value: 'lotus-cobra', label: 'Lotus Cobra', scryfall_id: null }],
          picker: { search_placeholder: 'Search cards', empty_label: 'Add what you control.' },
          mana: null,
          setup: true,
          persists_across_turns: true,
        }),
        field({ name: 'lands_this_turn', kind: 'counter', label: 'Lands', default: 0 }),
      ],
      outputs: [
        output({ name: 'effects', label: 'What each land drop does', kind: 'lines', primary: true, hero_shape: 'list' }),
        output({ name: 'triggers', label: 'Triggers', short_label: 'triggers' }),
      ],
    }
    render(<CardScreen card={landfallLike} />)

    expect(await screen.findByText('Add one mana of any color')).toBeInTheDocument()
    expect(screen.getByText('2 cards · 2 life')).toBeInTheDocument()
    // No number hero: the list is the headline.
    expect(screen.queryByTestId('hero-compact')).not.toBeInTheDocument()
    // The supporting stat still renders beside it.
    expect(screen.getByText('triggers')).toBeInTheDocument()
  })

  it('an empty list hero borrows the picker its own empty text', async () => {
    compute.mockReturnValue({ effects: [], triggers: 0 })
    const landfallLike: CardMetadata = {
      ...singleOutputCard,
      id: 'landfall-empty',
      fields: [
        field({
          name: 'sources',
          kind: 'sequence',
          default: [],
          options: [{ value: 'lotus-cobra', label: 'Lotus Cobra', scryfall_id: null }],
          picker: { search_placeholder: 'Search cards', empty_label: 'Add what you control.' },
          mana: null,
        }),
      ],
      outputs: [
        output({ name: 'effects', label: 'Effects', kind: 'lines', primary: true, hero_shape: 'list' }),
      ],
    }
    render(<CardScreen card={landfallLike} />)
    // Scoped to the hero: the picker below says the same thing, which is the point --
    // the hero borrows its text rather than inventing a second phrasing.
    const heroRegion = (await screen.findByText('Effects')).parentElement!
    expect(within(heroRegion).getByText('Add what you control.')).toBeInTheDocument()
  })

  it('falls back to generic empty text for a list hero with no picker behind it', async () => {
    compute.mockReturnValue({ effects: [] })
    const listNoPicker: CardMetadata = {
      ...singleOutputCard,
      id: 'list-no-picker',
      fields: [],
      outputs: [
        output({ name: 'effects', label: 'Effects', kind: 'lines', primary: true, hero_shape: 'list' }),
      ],
    }
    render(<CardScreen card={listNoPicker} />)
    expect(await screen.findByText('Nothing to show yet.')).toBeInTheDocument()
  })

  it('resets values via New turn without reopening the setup sheet', async () => {
    const user = userEvent.setup()
    render(<CardScreen card={aetherfluxLikeCard} />)
    await screen.findByRole('dialog', { name: 'Board state' })
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await user.click(await screen.findByRole('button', { name: 'Increase Spells cast this turn' }))
    expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(1)

    await user.click(screen.getByRole('button', { name: 'New turn' }))
    expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('Reset card', () => {
    async function openConfirmedCard(user: ReturnType<typeof userEvent.setup>) {
      render(<CardScreen card={aetherfluxLikeCard} />)
      await screen.findByRole('dialog', { name: 'Board state' })
      await user.click(screen.getByRole('button', { name: 'Done' }))
      await user.click(await screen.findByRole('button', { name: 'Increase Spells cast this turn' }))
    }

    it('lives in the header, not in a row under the action bar', async () => {
      // It used to be a full-width ghost button below the ActionBar, costing 64px of
      // every card's column and sitting below the fold on the tall ones -- one of the
      // two controls the user reported having to scroll to reach.
      const user = userEvent.setup()
      await openConfirmedCard(user)

      const header = screen.getByRole('banner')
      expect(within(header).getByRole('button', { name: 'Reset card' })).toBeInTheDocument()
    })

    it('asks before wiping anything, and changes nothing while the question is open', async () => {
      const user = userEvent.setup()
      await openConfirmedCard(user)
      expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(1)

      await user.click(screen.getByRole('button', { name: 'Reset card' }))
      expect(
        screen.getByRole('dialog', { name: 'Reset Aetherflux Reservoir?' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(1)
    })

    it('keeps everything when the reset is declined', async () => {
      const user = userEvent.setup()
      await openConfirmedCard(user)

      await user.click(screen.getByRole('button', { name: 'Reset card' }))
      await user.click(screen.getByRole('button', { name: 'Keep it' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(1)
    })

    it('clears the card and asks the board-state questions again once confirmed', async () => {
      const user = userEvent.setup()
      await openConfirmedCard(user)

      await user.click(screen.getByRole('button', { name: 'Reset card' }))
      // The confirm button repeats the action's own label, so scope the query to the
      // dialog rather than matching the screen's "Reset card" trigger behind it.
      const dialog = screen.getByRole('dialog', { name: 'Reset Aetherflux Reservoir?' })
      await user.click(within(dialog).getByRole('button', { name: 'Reset card' }))

      // Unlike New turn, this reopens setup: a fresh game needs its own board state.
      expect(await screen.findByRole('dialog', { name: 'Board state' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(screen.getByRole('spinbutton', { name: 'Spells cast this turn' })).toHaveValue(0)
    })

    it('opens no sheet on a card that has no setup fields to re-ask', async () => {
      const user = userEvent.setup()
      render(<CardScreen card={singleOutputCard} />)
      await user.click(await screen.findByRole('button', { name: 'Increase Creatures died' }))
      expect(screen.getByRole('spinbutton', { name: 'Creatures died' })).toHaveValue(1)

      await user.click(screen.getByRole('button', { name: 'Reset card' }))
      const dialog = screen.getByRole('dialog', { name: 'Reset Single Output Card?' })
      await user.click(within(dialog).getByRole('button', { name: 'Reset card' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: 'Creatures died' })).toHaveValue(0)
    })

    it('offers the reset on a game-long tracker, which has no New turn button at all', async () => {
      // commander-tax and dungeons set resets_on_new_turn: false. Before this existed
      // their tallies could never be zeroed without clearing browser storage.
      const user = userEvent.setup()
      const tracker: CardMetadata = {
        ...aetherfluxLikeCard,
        id: 'commander-tax-like',
        name: 'Commander Tax',
        resets_on_new_turn: false,
      }
      render(<CardScreen card={tracker} />)
      await screen.findByRole('dialog', { name: 'Board state' })
      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(screen.queryByRole('button', { name: 'New turn' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset card' })).toBeInTheDocument()
    })
  })
})
