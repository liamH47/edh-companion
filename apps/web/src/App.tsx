import { CARDS } from '@mtg/core'
import { recordCardOpened } from '@mtg/core'
import type { Route } from '@mtg/core'
import { CardPickerScreen } from './cards/CardPickerScreen'
import { CardScreen } from './cards/CardScreen'
import { CoinFlip } from './CoinFlip'
import { useNavigation } from './core/navigation/useNavigation'
import { DiceScreen } from './DiceScreen'
import { PairingsScreen } from './pairings/PairingsScreen'
import { SoundToggle } from './SoundToggle'
import { TabBar, type TabName } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

/** Which tab is highlighted for a given route. A `switch` rather than a ternary chain so
 * adding a route without mapping it is a type error, not a silently wrong highlight. */
function tabForRoute(name: Route['name']): TabName {
  switch (name) {
    case 'coin-flip':
      return 'coin'
    case 'swiss':
      return 'swiss'
    case 'dice':
      return 'dice'
    case 'card-picker':
    case 'card':
      return 'cards'
  }
}

/**
 * Every tab is now entirely local -- card metadata is bundled and compute runs in the
 * browser, so nothing here needs a connection. The loading and error states this file
 * used to carry existed only for the card-list fetch, which no longer happens.
 */
function App() {
  const { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss, goToDice } = useNavigation()

  const handleSelectCard = (cardId: string) => {
    recordCardOpened(cardId)
    goToCard(cardId)
  }

  const handleSelectTab = (tab: TabName) => {
    switch (tab) {
      case 'cards':
        return goToCardPicker()
      case 'coin':
        return goToCoinFlip()
      case 'swiss':
        return goToSwiss()
      case 'dice':
        return goToDice()
    }
  }

  // A card route whose id matches no card (a stale deep link) falls back to the picker
  // in place, without rewriting the URL.
  const selectedCard = route.name === 'card' ? CARDS.find((card) => card.id === route.cardId) : null

  // The card screen owns its own bottom-pinned ActionBar, so the tab bar would compete
  // with it for the same thumb-zone space -- hide it there (screen-spec.md).
  const showTabBar = !selectedCard

  return (
    <main
      className={`mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-canvas px-4 py-4 sm:px-6 sm:py-8 ${
        showTabBar ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : ''
      }`}
    >
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
          Commander&apos;s Companion
        </h1>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      {(route.name === 'card-picker' || route.name === 'card') &&
        (selectedCard ? (
          <CardScreen key={selectedCard.id} card={selectedCard} onBack={goToCardPicker} />
        ) : (
          <CardPickerScreen cards={CARDS} onSelectCard={handleSelectCard} />
        ))}

      {route.name === 'coin-flip' && <CoinFlip />}

      {route.name === 'swiss' && <PairingsScreen />}

      {route.name === 'dice' && <DiceScreen />}

      {showTabBar && <TabBar active={tabForRoute(route.name)} onSelect={handleSelectTab} />}
    </main>
  )
}

export default App
