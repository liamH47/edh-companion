import { useState } from 'react'
import { heroOutput, nonPrimaryOutputs, splitFields } from '@mtg/core'
import { useCardSession } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { ChevronLeftIcon, InfoIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Surface } from '../ui/Surface'
import { Text } from '../ui/Text'
import { ActionBar } from './ActionBar'
import { AlertBanner } from './AlertBanner'
import { FieldControl } from './FieldControl'
import { CardArtHero } from './CardArtHero'
import { CardImage } from './CardImage'
import { HeroStat } from './HeroStat'
import { LoyaltyShield } from './LoyaltyShield'
import { CardDetailSheet } from './CardDetailSheet'
import { SetupSheet } from './SetupSheet'
import { SetupSummaryBar } from './SetupSummaryBar'
import { StatStrip } from './StatStrip'

interface CardScreenProps {
  card: CardMetadata
  onBack?: () => void
}

/**
 * The card screen: hero number, supporting stat strip, only the controls actually
 * touched during a turn, and one-time setup collapsed into a summary bar + sheet.
 * Implements every generic rule in docs/ui/screen-spec.md -- no per-card branching.
 * Remount (e.g. via `key={card.id}` from a caller) to reset the sheet's
 * auto-open-once-per-visit state when switching cards.
 */
export function CardScreen({ card, onBack }: CardScreenProps) {
  const session = useCardSession(card)
  const { setupFields, liveFields, renderSetupInline } = splitFields(card, session.values)

  // Rule 3: an all-setup card renders its fields inline instead of behind a sheet
  // with nothing live underneath it, and suppresses the summary bar entirely.
  const sheetFields = renderSetupInline ? [] : setupFields
  const inlineFields = renderSetupInline ? setupFields : liveFields

  // Rule 4: auto-open once per visit when this card has unconfirmed setup. A lazy
  // useState initializer (not an effect) so it runs exactly once, on mount, using
  // the values already computed above -- remounting (a fresh `key`) is what makes a
  // *different* card re-evaluate this, not a dependency array.
  const [sheetOpen, setSheetOpen] = useState(
    () => sheetFields.length > 0 && !session.setupConfirmed,
  )
  const [rulesOpen, setRulesOpen] = useState(false)

  const hero = heroOutput(card)
  const heroValue = typeof session.outputs?.[hero.name] === 'number' ? (session.outputs[hero.name] as number) : 0

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        {onBack && (
          <Pressable
            aria-label="Back"
            onClick={onBack}
            className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
          >
            <ChevronLeftIcon />
          </Pressable>
        )}
        <Text as="h1" variant="title" className="flex-1">
          {card.name}
        </Text>
        <Pressable
          aria-label="View card"
          onClick={() => setRulesOpen(true)}
          className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
        >
          <InfoIcon />
        </Pressable>
      </header>

      <SetupSummaryBar
        fields={sheetFields}
        values={session.values}
        onPress={() => setSheetOpen(true)}
      />

      {session.error && (
        <Surface tone="danger" radius="lg" role="alert">
          <Text variant="body" color="danger">
            {session.error}
          </Text>
        </Surface>
      )}

      <AlertBanner message={session.alertMessage} />

      {/* The hero slot, driven by two schema flags with zero per-card branching. A
          shield hero with inline art becomes CardArtHero: the printed card, large,
          with the live loyalty drawn over its printed loyalty box (a recorded
          decision -- see cardImage.ts) and a standalone-shield fallback offline. Art
          without a shield keeps a small image beside the plain hero. */}
      {card.show_hero_art && hero.hero_shape === 'shield' ? (
        <CardArtHero
          card={card}
          label={hero.short_label ?? hero.label}
          value={heroValue}
          pending={session.pending}
          dead={session.alertMessage !== null}
        />
      ) : card.show_hero_art ? (
        <div className="flex items-center justify-center gap-4">
          <div className="w-28 flex-none">
            <CardImage card={card} />
          </div>
          <HeroStat
            label={hero.short_label ?? hero.label}
            value={heroValue}
            pending={session.pending}
          />
        </div>
      ) : hero.hero_shape === 'shield' ? (
        <LoyaltyShield
          label={hero.short_label ?? hero.label}
          value={heroValue}
          pending={session.pending}
          dead={session.alertMessage !== null}
        />
      ) : (
        <HeroStat label={hero.short_label ?? hero.label} value={heroValue} pending={session.pending} />
      )}

      <StatStrip outputs={nonPrimaryOutputs(card)} values={session.outputs} pending={session.pending} />

      {inlineFields.length > 0 && (
        <div className="flex flex-col gap-4">
          {inlineFields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              value={session.values[field.name]}
              onChange={session.setField}
            />
          ))}
        </div>
      )}

      <ActionBar
        liveFields={inlineFields}
        values={session.values}
        outputs={session.outputs}
        onFieldChange={session.setField}
        onNewTurn={session.resetTurn}
        showNewTurn={card.resets_on_new_turn}
      />

      <SetupSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        fields={sheetFields}
        values={session.values}
        onFieldChange={session.setField}
        onDone={session.confirmSetup}
      />

      <CardDetailSheet open={rulesOpen} onClose={() => setRulesOpen(false)} card={card} />
    </section>
  )
}
