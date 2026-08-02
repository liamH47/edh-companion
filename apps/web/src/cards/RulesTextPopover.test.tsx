import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RulesTextPopover } from './RulesTextPopover'

describe('RulesTextPopover', () => {
  it('renders nothing when closed', () => {
    render(
      <RulesTextPopover open={false} onClose={() => {}} title="Aetherflux Reservoir" rulesText="..." />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the title and rules text when open', () => {
    render(
      <RulesTextPopover
        open
        onClose={() => {}}
        title="Aetherflux Reservoir"
        rulesText="Whenever you cast a spell, you gain 1 life."
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Aetherflux Reservoir' })).toBeInTheDocument()
    expect(screen.getByText('Whenever you cast a spell, you gain 1 life.')).toBeInTheDocument()
  })
})
