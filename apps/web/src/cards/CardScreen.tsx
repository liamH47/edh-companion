import { useState } from 'react'
import { effectLines, heroOutput, nonPrimaryOutputs, splitFields } from '@mtg/core'
import { useCardSession } from '@mtg/core'
import type { CardMetadata } from '@mtg/core'
import { BackButton } from '../ui/BackButton'
import { ConfirmSheet } from '../ui/ConfirmSheet'
import { InfoIcon, ResetIcon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Surface } from '../ui/Surface'
import { Text } from '../ui/Text'
import { ActionBar } from './ActionBar'
import { AlertBanner } from './AlertBanner'
import { FieldControl } from './FieldControl'
import { CardArtHero } from './CardArtHero'
import { CardImage } from './CardImage'
import { EffectList } from './EffectList'
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
  // A mapped live field (a dungeon) is the screen's main event: hero and strip
  // compress into one row above it.
  const hasMappedField = liveFields.some((field) => field.map !== null)

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
  const [resetOpen, setResetOpen] = useState(false)

  const confirmReset = () => {
    session.resetCard()
    setResetOpen(false)
    // A reset card has no confirmed setup any more, so the board-state sheet asks
    // again -- the same thing rule 4 does on a first visit, for the same reason: a new
    // game needs its own answers. Opened here rather than from an effect watching
    // `setupConfirmed`, which would also fire on the reset that happens when *switching*
    // cards and reopen a sheet the player just dismissed.
    if (sheetFields.length > 0) setSheetOpen(true)
  }

  const hero = heroOutput(card)
  const heroValue = typeof session.outputs?.[hero.name] === 'number' ? (session.outputs[hero.name] as number) : 0
  // A list hero reads its rows instead of a number. The schema keeps `kind: 'lines'`
  // and `hero_shape: 'list'` declared together, so either flag identifies it.
  const heroLines = hero.hero_shape === 'list' ? effectLines(session.outputs?.[hero.name]) : []
  // An empty list means an empty roster, so the picker's own empty text is the useful
  // thing to say -- read off the schema rather than hardcoded per card.
  const rosterEmptyLabel =
    card.fields.find((field) => field.picker)?.picker?.empty_label ?? 'Nothing to show yet.'

  return (
    /* An app shell, not one long column: the header and the ActionBar are static and the
       middle scrolls between them. That is what makes the action the player taps every
       turn reachable without scrolling on a tall card -- Comet's printed art alone is
       401px, and dungeons' room map is ~518px, so "put the bar last in the column" only
       ever worked on the short cards. ErrorBoundary renders children directly, so this
       is a direct flex child of App's `h-dvh` main -- hence flex-1 rather than h-full.
       Ports as View flex:1 > ScrollView + footer View. */
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex items-center gap-3">
        {onBack && <BackButton onClick={onBack} />}
        <Text as="h1" variant="title" className="min-w-0 flex-1 truncate">
          {card.name}
        </Text>
        <Pressable
          aria-label="View card"
          onClick={() => setRulesOpen(true)}
          className="min-h-12 min-w-12 shrink-0 justify-center rounded-full text-text-muted hover:text-text"
        >
          <InfoIcon />
        </Pressable>
        {/* Beside "View card" rather than a full-width row under the ActionBar: a wipe
            still wants a deliberate reach (it keeps its ConfirmSheet), but it does not
            want 64px of every card's column -- including the 11 that never overflow --
            and it should not be something the player has to scroll to find. */}
        <Pressable
          aria-label="Reset card"
          onClick={() => setResetOpen(true)}
          className="min-h-12 min-w-12 shrink-0 justify-center rounded-full text-text-muted hover:text-danger"
        >
          <ResetIcon />
        </Pressable>
      </header>

      {/* min-h-0: a flex item's automatic minimum size is its content, so without this
          the region refuses to shrink and nothing scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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

      <AlertBanner message={session.alertMessage} tone={session.alertTone} />

      {/* The hero slot, driven by schema capabilities with zero per-card branching.
          A screen whose main event is a mapped field (a dungeon) folds hero and strip
          into one compact centred row so the map -- the thing the player acts on --
          sits near the top instead of below ~500px of read-only state. A shield hero
          with inline art becomes CardArtHero: the printed card, large, with the live
          loyalty drawn over its printed loyalty box (a recorded decision -- see
          cardImage.ts) and a standalone-shield fallback offline. Art without a shield
          keeps a small image beside the plain hero. */}
      {hero.hero_shape === 'list' ? (
        /* A list hero is itself the tall content, so the supporting numbers compress
           into one compact row above it -- the same shape a mapped field takes, and for
           the same reason: the thing the player reads on a land drop belongs near the
           top, not below a column of tiles. */
        <>
          <StatStrip
            outputs={nonPrimaryOutputs(card)}
            values={session.outputs}
            pending={session.pending}
            compact
          />
          <EffectList
            label={hero.label}
            lines={heroLines}
            pending={session.pending}
            emptyLabel={rosterEmptyLabel}
          />
        </>
      ) : hasMappedField ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <HeroStat
            label={hero.short_label ?? hero.label}
            value={heroValue}
            pending={session.pending}
            compact
          />
          <StatStrip
            outputs={nonPrimaryOutputs(card)}
            values={session.outputs}
            pending={session.pending}
            compact
          />
        </div>
      ) : (
        <>
          {card.show_hero_art && hero.hero_shape === 'shield' ? (
            <CardArtHero
              card={card}
              label={hero.short_label ?? hero.label}
              value={heroValue}
              pending={session.pending}
              dead={session.alertTone === 'danger'}
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
              dead={session.alertTone === 'danger'}
            />
          ) : (
            <HeroStat
              label={hero.short_label ?? hero.label}
              value={heroValue}
              pending={session.pending}
            />
          )}

          {/* Under card art the strip is annotation, not a peer panel to the card. */}
          <StatStrip
            outputs={nonPrimaryOutputs(card)}
            values={session.outputs}
            pending={session.pending}
            compact={card.show_hero_art}
          />
        </>
      )}

      {/* The read/act divider: state above the line, controls below it -- so the card
          art or hero never blends into the field stack at equal visual weight. */}
      {inlineFields.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
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
      </div>

      {/* Outside the scroll region: genuinely bottom-pinned now, which is what the
          ActionBar's own docstring has claimed since it was written. */}
      <ActionBar
        liveFields={inlineFields}
        values={session.values}
        outputs={session.outputs}
        onFieldChange={session.setField}
        onNewTurn={session.resetTurn}
        showNewTurn={card.resets_on_new_turn}
      />

      <ConfirmSheet
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={confirmReset}
        title={`Reset ${card.name}?`}
        message="Every field goes back to its default and the board-state questions get asked again. Nothing else on other cards is touched."
        confirmLabel="Reset card"
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
