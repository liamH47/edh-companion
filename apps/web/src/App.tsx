import { CARDS } from '@mtg/core'
import { recordCardOpened } from '@mtg/core'
import { CardPickerScreen } from './cards/CardPickerScreen'
import { CardScreen } from './cards/CardScreen'
import { CoinFlip } from './CoinFlip'
import { useNavigation } from './core/navigation/useNavigation'
import { SwissScreen } from './swiss/SwissScreen'
import { TabBar, type TabName } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

/**
 * Every tab is now entirely local -- card metadata is bundled and compute runs in the
 * browser, so nothing here needs a connection. The loading and error states this file
 * used to carry existed only for the card-list fetch, which no longer happens.
 */
function App() {
  const { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss } = useNavigation()

  const handleSelectCard = (cardId: string) => {
    recordCardOpened(cardId)
    goToCard(cardId)
  }

  const handleSelectTab = (tab: TabName) => {
    if (tab === 'cards') goToCardPicker()
    else if (tab === 'coin') goToCoinFlip()
    else goToSwiss()
  }

  const activeTab: TabName =
    route.name === 'coin-flip' ? 'coin' : route.name === 'swiss' ? 'swiss' : 'cards'

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
        <ThemeToggle />
      </header>

      {(route.name === 'card-picker' || route.name === 'card') &&
        (selectedCard ? (
          <CardScreen key={selectedCard.id} card={selectedCard} onBack={goToCardPicker} />
        ) : (
          <CardPickerScreen cards={CARDS} onSelectCard={handleSelectCard} />
        ))}

      {route.name === 'coin-flip' && <CoinFlip />}

      {route.name === 'swiss' && <SwissScreen />}

      {showTabBar && <TabBar active={activeTab} onSelect={handleSelectTab} />}
    </main>
  )
}

export default App
